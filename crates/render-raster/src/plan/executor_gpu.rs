//! `ShaderQuad` executor for the wgpu backend (element plan ADR-E06 / §10 P5).
//!
//! **The CPU tiny-skia path is the strict reference; this executor is only an accelerator** (ADR-M05). If it fails to start,
//! fails to compile, or fails conformance, the failure is recorded in [`GpuBackendReport`] and the CPU path is used, so the picture
//! is unaffected. The whole module is gated behind the `gpu` feature, which is off by default.
//!
//! ## Relationship to `PassExecutor`
//!
//! The motion stage 4 [`super::PassExecutor`] (`draw` / `filter` / `transition` / `composite`) has **already landed**. `ShaderQuad` is
//! none of those four, and §10 P5 states explicitly that “P5 must not unilaterally change BCOP / DrawOp v3; that is a stage 4 decision”.
//! Adding a fifth variant to `RenderPass` would also affect `FRAME_PLAN_VERSION` and the plan encoding. So P5a takes this approach:
//! [`GpuExecutor`] is a **separate quad executor** that coexists with `PassExecutor` without conflict; when the two lines merge,
//! [`GpuExecutor::render_quad`] just needs to be attached as a fifth pass method.
//!
//! ## Execution path of one quad (§8.1 / §8.3 / §8.5)
//!
//! 1. A single quad (4 vertices, triangle strip); all geometry is generated procedurally in the fragment shader;
//! 2. The vertex shader performs a **y-flip**, so texture coordinates have their origin at the top-left;
//! 3. Audio data is uploaded as a texture of `R8Unorm`, `w × 2`, **row 0 = time domain / row 1 = frequency domain, no flip**;
//!    sampler is linear + clamp-to-edge;
//! 4. `@group(1)` sends a separate uniform buffer per binding, in the frozen order of §8.2;
//! 5. Output is **premultiplied alpha**, render target is `Rgba8Unorm` (**not sRGB**: §8.5 says uniforms and output are both linear RGBA,
//!    and tiny-skia's `Pixmap` is also linear premultiplied bytes, so both sides share the same number domain and readback applies no
//!    colour transform).

use std::collections::HashMap;

use anyhow::{Result, bail};
// Only needed for naga validation (and for the native `gpu` build that uses it).
#[cfg(feature = "wgsl-validate")]
use anyhow::{Context, anyhow};
#[cfg(feature = "gpu")]
use tiny_skia::Pixmap;

use super::gpu_fallback::GpuBackendReport;
#[cfg(feature = "gpu")]
use super::gpu_fallback::GpuFallbackReason;
#[cfg(feature = "gpu")]
use super::shader_quad::QuadUniforms;
use super::shader_quad::{AudioTexture, ShaderQuad, UniformBinding};
use super::shader_source::{FRAGMENT_ENTRY, ShaderDomain, ShaderSource, VERTEX_ENTRY};

/// Row alignment of the readback buffer (a hard wgpu requirement).
#[cfg(feature = "gpu")]
const COPY_ALIGN: u32 = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;

/// Vertices of a single quad: `(pos.xy, uv.xy)`.
///
/// `pos` is already in NDC (`u_transform` is the identity matrix), **and it has been pre-negated in y to cancel the vertex shader's
/// `-pos.y`** — so `uv.y == 0` lands on the top edge of the frame, with the texture origin at the top-left (§8.1). §8.1 freezes that
/// y-flip, and these four vertices are the data that goes with it.
#[rustfmt::skip]
const QUAD_VERTICES: [f32; 16] = [
    -1.0, -1.0, 0.0, 0.0, // Top-left
     1.0, -1.0, 1.0, 0.0, // Top-right
    -1.0,  1.0, 0.0, 1.0, // Bottom-left
     1.0,  1.0, 1.0, 1.0, // Bottom-right
];

/// wgpu device + pipeline cache.
pub struct GpuExecutor {
    device: wgpu::Device,
    queue: wgpu::Queue,
    backend: String,
    adapter_name: String,
    sampler: wgpu::Sampler,
    vertices: wgpu::Buffer,
    group0: wgpu::BindGroupLayout,
    group1_visualizer: wgpu::BindGroupLayout,
    group1_progress: wgpu::BindGroupLayout,
    group2_audio: wgpu::BindGroupLayout,
    group2_empty: wgpu::BindGroupLayout,
    group3_recipe: wgpu::BindGroupLayout,
    pipelines: HashMap<String, wgpu::RenderPipeline>,
    live_bindings: Vec<LiveBindings>,
    live_binding_rebuilds: u64,
    report: GpuBackendReport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LiveBindingSignature {
    domain: ShaderDomain,
    recipe_bytes: usize,
    audio: Option<(u32, u32)>,
}

struct LiveUniformGroup {
    buffers: Vec<wgpu::Buffer>,
    bind_group: wgpu::BindGroup,
}

enum LiveDataGroup {
    Audio {
        texture: wgpu::Texture,
        bind_group: wgpu::BindGroup,
    },
    Empty(wgpu::BindGroup),
}

struct LiveBindings {
    signature: LiveBindingSignature,
    group0: LiveUniformGroup,
    group1: LiveUniformGroup,
    group2: LiveDataGroup,
    group3: LiveUniformGroup,
}

struct LiveBindingLayouts<'a> {
    group0: &'a wgpu::BindGroupLayout,
    group1: &'a wgpu::BindGroupLayout,
    group2_audio: &'a wgpu::BindGroupLayout,
    group2_empty: &'a wgpu::BindGroupLayout,
    group3: &'a wgpu::BindGroupLayout,
    sampler: &'a wgpu::Sampler,
}

struct LiveBindingPayload<'a> {
    transform: &'a [UniformBinding],
    uniforms: &'a [UniformBinding],
    recipe: &'a [UniformBinding],
    audio: Option<&'a AudioTexture>,
}

impl GpuExecutor {
    /// Initializes the device. **Each platform first probes its own native backend**, and falls back to others only if that fails;
    /// if none is available, it returns `Err` and the caller falls back to CPU.
    ///
    /// The order is about more than "which is slightly faster": it decides whether the platform's direct encoding path can be used:
    ///
    /// - **Windows**: Media Foundation direct encoding (`ccut-kernel`'s `studio_export/video_windows.rs`: D3D11On12 + `IMFDXGIDeviceManager`)
    ///   can only borrow `ID3D12Device` / `ID3D12CommandQueue` from a **DX12** wgpu device. When Vulkan was picked, `raw_dx12()` on that
    ///   side failed on the spot, the whole direct path was silently disabled, and export fell back to "per-frame GPU composite → read
    ///   back 8 MB to CPU → convert to NV12 on CPU → memory samples". The cost was never measured on its own (`CCUT_EXPORT_PROFILE` counts
    ///   the readback in "GPU composite + readback"), but what is certain is that it adds one full-frame readback and one CPU NV12
    ///   conversion per frame — the latter measured at 1.1 ms/frame at 720p / 1799 frames on an RTX 3060. On Windows, Vulkan **always**
    ///   matched before DX12 (NVIDIA and AMD drivers both ship Vulkan), so the original fixed order meant that path could never be reached.
    /// - **macOS**: probe Metal only, once. `Backends::all()` may also pick another backend on macOS (for example Vulkan via MoltenVK),
    ///   but we want the native one.
    ///
    /// A tier that cannot be probed fails immediately and moves on to the next, so leaving nonexistent backends in the list on each
    /// platform is harmless; this keeps the three branches the same shape and does not miss the case of "only one is present on a new machine".
    #[cfg(feature = "gpu")]
    pub fn new() -> Result<GpuExecutor> {
        let order = if cfg!(target_os = "macos") {
            [
                wgpu::Backends::METAL,
                wgpu::Backends::VULKAN,
                wgpu::Backends::DX12,
            ]
        } else if cfg!(target_os = "windows") {
            [
                wgpu::Backends::DX12,
                wgpu::Backends::VULKAN,
                wgpu::Backends::METAL,
            ]
        } else {
            [
                wgpu::Backends::VULKAN,
                wgpu::Backends::DX12,
                wgpu::Backends::METAL,
            ]
        };
        for backends in order {
            match GpuExecutor::with_backends(backends) {
                Ok(executor) => return Ok(executor),
                Err(_) => continue,
            }
        }
        bail!("gpu-backend-unavailable: no adapter available from Metal / Vulkan / DX12")
    }

    #[cfg(feature = "gpu")]
    fn with_backends(backends: wgpu::Backends) -> Result<GpuExecutor> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends,
            ..wgpu::InstanceDescriptor::new_without_display_handle()
        });
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        }))
        .map_err(|error| anyhow!("request_adapter failed: {error}"))?;
        let info = adapter.get_info();
        // On Windows, WARP would add texture uploads/readbacks around a CPU
        // rasterizer. Let auto callers use the native CPU reference instead.
        // Explicit host devices (from_device) remain usable for conformance.
        #[cfg(target_os = "windows")]
        if info.device_type == wgpu::DeviceType::Cpu {
            bail!("gpu-backend-unavailable: software adapter {}", info.name);
        }
        // **Take the adapter's actual limits** rather than `downlevel_defaults()`: the latter's `max_texture_dimension_2d` is only 2048,
        // so even a 1080p horizontal bar element (1920 wide) barely hits the cap, and supersampling would go out of bounds outright.
        // This executor's resources are just "one target texture + one w×2 audio texture + a dozen small uniform buffers", so it does not
        // need limits to constrain itself; what really has to be blocked is "the target is larger than the device can draw", and that is
        // checked explicitly and falls back in [`Self::render_quad_at`]; see the comment there.
        //
        // The WebGL2 path in P6 has stricter limits (these values must be re-evaluated on that line), and it is not part of P5a.
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("ccut-render.gpu"),
            required_limits: adapter.limits(),
            ..Default::default()
        }))
        .map_err(|error| anyhow!("request_device failed: {error}"))?;
        // A validation failure on a self-created device should not panic the whole process; falling back to CPU is the established policy.
        // An injected host device keeps the host's own uncaptured-error handler.
        device.on_uncaptured_error(std::sync::Arc::new(|error| {
            eprintln!("ccut-render gpu: uncaught wgpu error: {error}");
        }));

        Ok(GpuExecutor::from_device(
            device,
            queue,
            format!("{:?}", info.backend).to_lowercase(),
            info.name,
        ))
    }

    /// Reuses the wgpu device/queue already created by the host. The real-time compositor must be on the same device as the target
    /// texture; creating a separate adapter/device would prevent IOSurface/shared textures from being used directly as render attachments.
    /// Headless conformance still goes through [`Self::new`].
    pub fn from_device(
        device: wgpu::Device,
        queue: wgpu::Queue,
        backend: impl Into<String>,
        adapter_name: impl Into<String>,
    ) -> GpuExecutor {
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("ccut.audio.sampler"),
            // §8.1: linear sampling + clamp-to-edge. The CPU reference `kernel::sample_row_linear` is the equivalent implementation of this pair.
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::MipmapFilterMode::Nearest,
            ..Default::default()
        });

        let vertices = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("ccut.quad.vertices"),
            size: std::mem::size_of_val(&QUAD_VERTICES) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        queue.write_buffer(&vertices, 0, bytemuck_cast(&QUAD_VERTICES));

        let group0 = uniform_layout(&device, "ccut.group0", 2, wgpu::ShaderStages::VERTEX);
        let group1_visualizer =
            uniform_layout(&device, "ccut.group1.viz", 8, wgpu::ShaderStages::FRAGMENT);
        let group1_progress =
            uniform_layout(&device, "ccut.group1.prog", 9, wgpu::ShaderStages::FRAGMENT);
        let group3_recipe = uniform_layout(
            &device,
            "ccut.group3.recipe",
            1,
            wgpu::ShaderStages::FRAGMENT,
        );
        let group2_audio = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("ccut.group2.audio"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        // progress has no `@group(2)`, but `@group(3)` requires the layout array to be contiguous: insert an empty layout in between
        // (corresponding to an empty bind group).
        let group2_empty = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("ccut.group2.empty"),
            entries: &[],
        });

        GpuExecutor {
            device,
            queue,
            backend: backend.into(),
            adapter_name: adapter_name.into(),
            sampler,
            vertices,
            group0,
            group1_visualizer,
            group1_progress,
            group2_audio,
            group2_empty,
            group3_recipe,
            pipelines: HashMap::new(),
            live_bindings: Vec::new(),
            live_binding_rebuilds: 0,
            report: GpuBackendReport::default(),
        }
    }

    /// The compositor's target texture and the executor must come from this device.
    pub fn device(&self) -> &wgpu::Device {
        &self.device
    }

    /// The queue that submits real-time composite commands.
    pub fn queue(&self) -> &wgpu::Queue {
        &self.queue
    }

    /// Identifier of the backend actually obtained (`"metal"` / `"vulkan"` / `"dx12"`).
    pub fn backend(&self) -> &str {
        &self.backend
    }

    /// Adapter name. **Bit-for-bit consistency across devices is not promised** (ADR-E06); it is included in the report so that
    /// conformance measurements can be attributed to a device.
    pub fn adapter_name(&self) -> &str {
        &self.adapter_name
    }

    /// Fallback report for this session.
    pub fn report(&self) -> GpuBackendReport {
        let mut report = self.report.clone();
        report.backend = Some(self.backend.clone());
        report
    }

    /// Executes one `ShaderQuad` and returns that quad's own region of the frame (premultiplied RGBA8).
    #[cfg(feature = "gpu")]
    pub fn render_quad(&mut self, quad: &ShaderQuad) -> Result<Pixmap> {
        self.render_quad_at(quad, 1)
    }

    /// Supersampled version: the render target is enlarged by `factor`, then **box**-downsampled.
    ///
    /// Why it is needed: the CPU reference is a vector path with the rasterizer's analytic anti-aliasing, while the reference shader has
    /// **hard steps** in several places (`bars-v1`'s `yFactor` is `select(0,1,·)`), so at 1x the bar tops render with jagged edges. To
    /// compare edges channel by channel, the GPU side also needs comparable anti-aliasing first. When `factor == 1`, this path is
    /// identical to [`Self::render_quad`] (with no extra allocation).
    #[cfg(feature = "gpu")]
    pub fn render_quad_at(&mut self, quad: &ShaderQuad, factor: u32) -> Result<Pixmap> {
        let factor = factor.max(1);
        let width = quad.target.width.max(1);
        let height = quad.target.height.max(1);
        let (rw, rh) = (width * factor, height * factor);

        // An out-of-bounds size must become a **readable `Err`** (the caller falls back to CPU on it), not an uncaptured validation error
        // like "TextureView is invalid" — the latter silently blacks out the whole frame. This was a pitfall hit during testing at this
        // stage: supersampling enlarged a 1920-wide horizontal bar element to 7680, which at once exceeded the 2048 limit of the
        // `downlevel_defaults()` then in use.
        let max = self.device.limits().max_texture_dimension_2d;
        if rw > max || rh > max {
            bail!("gpu-execution-failed: render target {rw}x{rh} ({factor}× supersampling) exceeds the device limit {max}");
        }

        let pipeline = self.pipeline(quad.shader, wgpu::TextureFormat::Rgba8Unorm, false)?;
        let bind0 = self.bind_uniforms(&self.group0, &quad.transform.bindings(), "group0");
        let group1_layout = match quad.uniforms {
            QuadUniforms::Visualizer(_) => &self.group1_visualizer,
            QuadUniforms::Progress(_) => &self.group1_progress,
        };
        let bind1 = self.bind_uniforms(group1_layout, &quad.uniforms.bindings(), "group1");
        let bind3 = self.bind_uniforms(
            &self.group3_recipe,
            &[super::shader_quad::UniformBinding {
                binding: 0,
                name: "u_recipe",
                bytes: quad.recipe.bytes.clone(),
            }],
            "group3",
        );
        let bind2 = match &quad.data_texture {
            Some(audio) => self.bind_audio(audio),
            None => self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("ccut.group2.empty"),
                layout: &self.group2_empty,
                entries: &[],
            }),
        };

        let target = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("ccut.quad.target"),
            size: wgpu::Extent3d {
                width: rw,
                height: rh,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            // Not sRGB: §8.5's linear RGBA, in the same number domain as tiny-skia's bytes.
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = target.create_view(&wgpu::TextureViewDescriptor::default());

        let padded = padded_bytes_per_row(rw);
        let readback = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("ccut.quad.readback"),
            size: u64::from(padded) * u64::from(rh),
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("ccut.quad.encoder"),
            });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("ccut.quad.pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        // Transparent background: the quad draws only itself; compositing is left to the caller.
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_pipeline(&pipeline);
            pass.set_bind_group(0, &bind0, &[]);
            pass.set_bind_group(1, &bind1, &[]);
            pass.set_bind_group(2, &bind2, &[]);
            pass.set_bind_group(3, &bind3, &[]);
            pass.set_vertex_buffer(0, self.vertices.slice(..));
            pass.draw(0..4, 0..1);
        }
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &target,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &readback,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0,
                    bytes_per_row: Some(padded),
                    rows_per_image: Some(rh),
                },
            },
            wgpu::Extent3d {
                width: rw,
                height: rh,
                depth_or_array_layers: 1,
            },
        );
        self.queue.submit(Some(encoder.finish()));

        let slice = readback.slice(..);
        let (sender, receiver) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = sender.send(result);
        });
        self.device
            .poll(wgpu::PollType::wait_indefinitely())
            .map_err(|error| anyhow!("waiting for GPU readback failed: {error:?}"))?;
        receiver
            .recv()
            .context("readback channel disconnected")?
            .map_err(|error| anyhow!("buffer mapping failed: {error}"))?;
        let mapped = slice
            .get_mapped_range()
            .map_err(|error| anyhow!("fetching the readback range failed: {error}"))?;
        let mut rgba = Vec::with_capacity((rw * rh * 4) as usize);
        for row in 0..rh {
            let start = (row * padded) as usize;
            rgba.extend_from_slice(&mapped[start..start + (rw * 4) as usize]);
        }
        drop(mapped);
        readback.unmap();

        let rgba = if factor == 1 {
            rgba
        } else {
            box_downsample(&rgba, rw, rh, factor)
        };
        into_pixmap(rgba, width, height)
    }

    /// Draws one quad directly into the caller's render target. The real-time path goes only through this: it does not create a
    /// readback buffer or call `map_async`, so output stays on the GPU.
    ///
    /// `clear = true` clears to a transparent background; otherwise the target is kept and composited with premultiplied source-over.
    pub fn render_quad_to_view(
        &mut self,
        quad: &ShaderQuad,
        view: &wgpu::TextureView,
        format: wgpu::TextureFormat,
        clear: bool,
    ) -> Result<()> {
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("ccut.compositor.quad.encoder"),
            });
        self.encode_quad_to_view(0, quad, view, format, clear, &mut encoder)?;
        self.finish_live_frame(1);
        self.queue.submit(Some(encoder.finish()));
        Ok(())
    }

    /// Appends the quad pass to the caller's command encoder. The shared compositor uses this to combine the vector and shader nodes of
    /// a whole frame into a single queue submit; the target and encoder must come from the same device that created this executor.
    pub fn encode_quad_to_view(
        &mut self,
        slot: usize,
        quad: &ShaderQuad,
        view: &wgpu::TextureView,
        format: wgpu::TextureFormat,
        clear: bool,
        encoder: &mut wgpu::CommandEncoder,
    ) -> Result<()> {
        let pipeline = self.pipeline(quad.shader, format, true)?;
        self.update_live_bindings(slot, quad)?;
        let bindings = &self.live_bindings[slot];

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("ccut.compositor.quad.pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: if clear {
                            wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT)
                        } else {
                            wgpu::LoadOp::Load
                        },
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_pipeline(&pipeline);
            pass.set_bind_group(0, &bindings.group0.bind_group, &[]);
            pass.set_bind_group(1, &bindings.group1.bind_group, &[]);
            pass.set_bind_group(2, bindings.group2.bind_group(), &[]);
            pass.set_bind_group(3, &bindings.group3.bind_group, &[]);
            pass.set_vertex_buffer(0, self.vertices.slice(..));
            pass.draw(0..4, 0..1);
        }
        Ok(())
    }

    /// Discards the trailing slots not used in this frame. For stable scenes, the Vec and each slot's buffer/bind group are kept across
    /// frames; when the node count shrinks, resources are released as the tail is truncated.
    pub fn finish_live_frame(&mut self, used_quad_slots: usize) {
        self.live_bindings.truncate(used_quad_slots);
    }

    /// The cumulative number of real-time binding slots rebuilt since the executor was created, used by the compositor's performance gate.
    pub fn live_binding_rebuilds(&self) -> u64 {
        self.live_binding_rebuilds
    }

    fn update_live_bindings(&mut self, slot: usize, quad: &ShaderQuad) -> Result<()> {
        let signature = LiveBindingSignature {
            domain: quad.domain(),
            recipe_bytes: quad.recipe.bytes.len(),
            audio: quad
                .data_texture
                .as_ref()
                .map(|audio| (audio.width, audio.rows)),
        };
        match (signature.domain, signature.audio) {
            (ShaderDomain::Visualizer, None) => {
                bail!("gpu-quad-bindings-invalid: visualizer is missing its audio texture")
            }
            (ShaderDomain::Progress, Some(_)) => {
                bail!("gpu-quad-bindings-invalid: progress does not accept an audio texture")
            }
            _ => {}
        }
        let transform = quad.transform.bindings();
        let uniforms = quad.uniforms.bindings();
        let recipe = [UniformBinding {
            binding: 0,
            name: "u_recipe",
            bytes: quad.recipe.bytes.clone(),
        }];
        let rebuild = self
            .live_bindings
            .get(slot)
            .is_none_or(|bindings| bindings.signature != signature);
        if rebuild {
            let group1_layout = match signature.domain {
                ShaderDomain::Visualizer => &self.group1_visualizer,
                ShaderDomain::Progress => &self.group1_progress,
            };
            let bindings = LiveBindings::new(
                &self.device,
                &self.queue,
                signature,
                LiveBindingLayouts {
                    group0: &self.group0,
                    group1: group1_layout,
                    group2_audio: &self.group2_audio,
                    group2_empty: &self.group2_empty,
                    group3: &self.group3_recipe,
                    sampler: &self.sampler,
                },
                LiveBindingPayload {
                    transform: &transform,
                    uniforms: &uniforms,
                    recipe: &recipe,
                    audio: quad.data_texture.as_ref(),
                },
            );
            if slot == self.live_bindings.len() {
                self.live_bindings.push(bindings);
            } else if slot < self.live_bindings.len() {
                self.live_bindings[slot] = bindings;
            } else {
                bail!(
                    "gpu-quad-slot-invalid: requested {slot}, next is {}",
                    self.live_bindings.len()
                );
            }
            self.live_binding_rebuilds += 1;
        } else {
            self.live_bindings[slot].write(
                &self.queue,
                LiveBindingPayload {
                    transform: &transform,
                    uniforms: &uniforms,
                    recipe: &recipe,
                    audio: quad.data_texture.as_ref(),
                },
            )?;
        }
        Ok(())
    }

    fn pipeline(
        &mut self,
        source: &'static ShaderSource,
        format: wgpu::TextureFormat,
        alpha_over: bool,
    ) -> Result<wgpu::RenderPipeline> {
        let key = format!(
            "{}:{format:?}:{}",
            source.label(),
            if alpha_over { "over" } else { "replace" }
        );
        if let Some(pipeline) = self.pipelines.get(&key) {
            return Ok(pipeline.clone());
        }
        let wgsl = source.assemble();
        // Run naga first: a source error becomes a readable `Err` here, rather than wgpu's internal uncaptured validation error (that path
        // logs and then yields an unusable pipeline). The Web WebGPU build does not enable `wgsl-validate`: the shaders are built-in source
        // and each one is validated by native tests; the browser's own validation errors reach the host via the uncaptured error and make
        // it fall back to CPU.
        #[cfg(feature = "wgsl-validate")]
        validate_wgsl(&wgsl).with_context(|| format!("WGSL validation failed for {key}"))?;
        let module = self
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some(&key),
                source: wgpu::ShaderSource::Wgsl(wgsl.into()),
            });
        let group1 = match source.domain {
            ShaderDomain::Visualizer => &self.group1_visualizer,
            ShaderDomain::Progress => &self.group1_progress,
        };
        let group2 = match source.domain {
            ShaderDomain::Visualizer => &self.group2_audio,
            ShaderDomain::Progress => &self.group2_empty,
        };
        let layout = self
            .device
            .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(&key),
                bind_group_layouts: &[
                    Some(&self.group0),
                    Some(group1),
                    Some(group2),
                    Some(&self.group3_recipe),
                ],
                immediate_size: 0,
            });
        // Native conformance needs to collect pipeline validation errors synchronously; the browser real-time path cannot block the JS
        // event loop with pollster, so the device's uncaptured error handler records them and the host falls back to CPU.
        #[cfg(feature = "gpu")]
        let scope = self.device.push_error_scope(wgpu::ErrorFilter::Validation);
        let pipeline = self
            .device
            .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(&key),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &module,
                    entry_point: Some(VERTEX_ENTRY),
                    compilation_options: Default::default(),
                    buffers: &[Some(wgpu::VertexBufferLayout {
                        array_stride: 16,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &[
                            wgpu::VertexAttribute {
                                format: wgpu::VertexFormat::Float32x2,
                                offset: 0,
                                shader_location: 0,
                            },
                            wgpu::VertexAttribute {
                                format: wgpu::VertexFormat::Float32x2,
                                offset: 8,
                                shader_location: 1,
                            },
                        ],
                    })],
                },
                primitive: wgpu::PrimitiveState {
                    topology: wgpu::PrimitiveTopology::TriangleStrip,
                    cull_mode: None,
                    ..Default::default()
                },
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                fragment: Some(wgpu::FragmentState {
                    module: &module,
                    entry_point: Some(FRAGMENT_ENTRY),
                    compilation_options: Default::default(),
                    targets: &[Some(wgpu::ColorTargetState {
                        format,
                        // The output is already premultiplied; offline comparison overwrites a transparent target, while the real-time compositing path
                        // does source-over onto the existing target.
                        blend: alpha_over.then_some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                }),
                multiview_mask: None,
                cache: None,
            });
        #[cfg(feature = "gpu")]
        if let Some(error) = pollster::block_on(scope.pop()) {
            self.report.push(
                None,
                GpuFallbackReason::ShaderCompile,
                format!("{key}: {error}"),
            );
            bail!("gpu-shader-compile-failed: {key}: {error}");
        }
        self.pipelines.insert(key.clone(), pipeline.clone());
        Ok(pipeline)
    }

    #[cfg(feature = "gpu")]
    fn bind_uniforms(
        &self,
        layout: &wgpu::BindGroupLayout,
        uniforms: &[super::shader_quad::UniformBinding],
        label: &str,
    ) -> wgpu::BindGroup {
        let buffers: Vec<wgpu::Buffer> = uniforms
            .iter()
            .map(|uniform| {
                let buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some(uniform.name),
                    size: uniform.bytes.len() as u64,
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                self.queue.write_buffer(&buffer, 0, &uniform.bytes);
                buffer
            })
            .collect();
        let entries: Vec<wgpu::BindGroupEntry> = uniforms
            .iter()
            .zip(&buffers)
            .map(|(uniform, buffer)| wgpu::BindGroupEntry {
                binding: uniform.binding,
                resource: buffer.as_entire_binding(),
            })
            .collect();
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some(label),
            layout,
            entries: &entries,
        })
    }

    /// §8.3: `R8Unorm`, `w × 2`, row 0 = time domain / row 1 = frequency domain, **no flip**.
    #[cfg(feature = "gpu")]
    fn bind_audio(&self, audio: &super::shader_quad::AudioTexture) -> wgpu::BindGroup {
        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("ccut.audio"),
            size: wgpu::Extent3d {
                width: audio.width,
                height: audio.rows,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        write_audio_texture(&self.queue, &texture, audio);
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("ccut.group2.audio"),
            layout: &self.group2_audio,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        })
    }
}

impl LiveUniformGroup {
    fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        layout: &wgpu::BindGroupLayout,
        uniforms: &[UniformBinding],
        label: &str,
    ) -> Self {
        let buffers: Vec<wgpu::Buffer> = uniforms
            .iter()
            .map(|uniform| {
                let buffer = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some(uniform.name),
                    size: uniform.bytes.len() as u64,
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                queue.write_buffer(&buffer, 0, &uniform.bytes);
                buffer
            })
            .collect();
        let entries: Vec<wgpu::BindGroupEntry> = uniforms
            .iter()
            .zip(&buffers)
            .map(|(uniform, buffer)| wgpu::BindGroupEntry {
                binding: uniform.binding,
                resource: buffer.as_entire_binding(),
            })
            .collect();
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some(label),
            layout,
            entries: &entries,
        });
        Self {
            buffers,
            bind_group,
        }
    }

    fn write(&self, queue: &wgpu::Queue, uniforms: &[UniformBinding]) -> Result<()> {
        if self.buffers.len() != uniforms.len() {
            bail!(
                "gpu-live-uniform-shape-changed: {} buffers != {} uniforms",
                self.buffers.len(),
                uniforms.len()
            );
        }
        for (buffer, uniform) in self.buffers.iter().zip(uniforms) {
            if buffer.size() != uniform.bytes.len() as u64 {
                bail!(
                    "gpu-live-uniform-size-changed: {} is {} bytes, expected {}",
                    uniform.name,
                    uniform.bytes.len(),
                    buffer.size()
                );
            }
            queue.write_buffer(buffer, 0, &uniform.bytes);
        }
        Ok(())
    }
}

impl LiveDataGroup {
    fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        audio_layout: &wgpu::BindGroupLayout,
        empty_layout: &wgpu::BindGroupLayout,
        sampler: &wgpu::Sampler,
        audio: Option<&AudioTexture>,
    ) -> Self {
        let Some(audio) = audio else {
            return Self::Empty(device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("ccut.live.group2.empty"),
                layout: empty_layout,
                entries: &[],
            }));
        };
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("ccut.live.audio"),
            size: wgpu::Extent3d {
                width: audio.width,
                height: audio.rows,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        write_audio_texture(queue, &texture, audio);
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("ccut.live.group2.audio"),
            layout: audio_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
            ],
        });
        Self::Audio {
            texture,
            bind_group,
        }
    }

    fn write(&self, queue: &wgpu::Queue, audio: Option<&AudioTexture>) -> Result<()> {
        match (self, audio) {
            (LiveDataGroup::Audio { texture, .. }, Some(audio)) => {
                write_audio_texture(queue, texture, audio);
                Ok(())
            }
            (LiveDataGroup::Empty(_), None) => Ok(()),
            _ => bail!("gpu-live-audio-shape-changed: binding cache signature mismatch"),
        }
    }

    fn bind_group(&self) -> &wgpu::BindGroup {
        match self {
            LiveDataGroup::Audio { bind_group, .. } | LiveDataGroup::Empty(bind_group) => {
                bind_group
            }
        }
    }
}

impl LiveBindings {
    fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        signature: LiveBindingSignature,
        layouts: LiveBindingLayouts<'_>,
        payload: LiveBindingPayload<'_>,
    ) -> Self {
        Self {
            signature,
            group0: LiveUniformGroup::new(
                device,
                queue,
                layouts.group0,
                payload.transform,
                "ccut.live.group0",
            ),
            group1: LiveUniformGroup::new(
                device,
                queue,
                layouts.group1,
                payload.uniforms,
                "ccut.live.group1",
            ),
            group2: LiveDataGroup::new(
                device,
                queue,
                layouts.group2_audio,
                layouts.group2_empty,
                layouts.sampler,
                payload.audio,
            ),
            group3: LiveUniformGroup::new(
                device,
                queue,
                layouts.group3,
                payload.recipe,
                "ccut.live.group3",
            ),
        }
    }

    fn write(&self, queue: &wgpu::Queue, payload: LiveBindingPayload<'_>) -> Result<()> {
        self.group0.write(queue, payload.transform)?;
        self.group1.write(queue, payload.uniforms)?;
        self.group2.write(queue, payload.audio)?;
        self.group3.write(queue, payload.recipe)?;
        Ok(())
    }
}

/// The `bytes_per_row` for `write_texture` is just `width`: the data is row-major and tightly packed row by row, **upload order is
/// the row number**, with no flipping at all.
fn write_audio_texture(queue: &wgpu::Queue, texture: &wgpu::Texture, audio: &AudioTexture) {
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        &audio.data,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(audio.width),
            rows_per_image: Some(audio.rows),
        },
        wgpu::Extent3d {
            width: audio.width,
            height: audio.rows,
            depth_or_array_layers: 1,
        },
    );
}

fn uniform_layout(
    device: &wgpu::Device,
    label: &str,
    count: u32,
    visibility: wgpu::ShaderStages,
) -> wgpu::BindGroupLayout {
    let entries: Vec<wgpu::BindGroupLayoutEntry> = (0..count)
        .map(|binding| wgpu::BindGroupLayoutEntry {
            binding,
            visibility,
            ty: wgpu::BindingType::Buffer {
                ty: wgpu::BufferBindingType::Uniform,
                has_dynamic_offset: false,
                min_binding_size: None,
            },
            count: None,
        })
        .collect();
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some(label),
        entries: &entries,
    })
}

/// naga static validation: `wgsl-in` parsing + the full capabilities of `Validator`.
///
/// This is the same path as `tests/shader_wgsl.rs`; the test additionally runs a GLSL ES 300 translation pass.
#[cfg(feature = "wgsl-validate")]
pub fn validate_wgsl(source: &str) -> Result<naga::Module> {
    let module = naga::front::wgsl::parse_str(source)
        .map_err(|error| anyhow!("WGSL parse failed: {}", error.emit_to_string(source)))?;
    let mut validator = naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::default(),
    );
    validator
        .validate(&module)
        .map_err(|error| anyhow!("WGSL validation failed: {}", error.emit_to_string(source)))?;
    Ok(module)
}

#[cfg(feature = "gpu")]
fn padded_bytes_per_row(width: u32) -> u32 {
    let unpadded = width * 4;
    unpadded.div_ceil(COPY_ALIGN) * COPY_ALIGN
}

/// Box downsampling. Averaging **in the premultiplied number domain** is the correct approach: averaging non-premultiplied values
/// would bring the colours of transparent pixels into the result.
#[cfg(feature = "gpu")]
fn box_downsample(rgba: &[u8], width: u32, height: u32, factor: u32) -> Vec<u8> {
    let (out_w, out_h) = (width / factor, height / factor);
    let area = f32::from(factor as u16) * f32::from(factor as u16);
    let mut out = Vec::with_capacity((out_w * out_h * 4) as usize);
    for y in 0..out_h {
        for x in 0..out_w {
            let mut sums = [0f32; 4];
            for dy in 0..factor {
                for dx in 0..factor {
                    let sx = x * factor + dx;
                    let sy = y * factor + dy;
                    let base = ((sy * width + sx) * 4) as usize;
                    for channel in 0..4 {
                        sums[channel] += f32::from(rgba[base + channel]);
                    }
                }
            }
            for sum in sums {
                out.push((sum / area).round().clamp(0.0, 255.0) as u8);
            }
        }
    }
    out
}

#[cfg(feature = "gpu")]
fn into_pixmap(mut rgba: Vec<u8>, width: u32, height: u32) -> Result<Pixmap> {
    // Defensive: the premultiplied invariant is `rgb ≤ a`. Shader output satisfies it naturally, but rounding during downsampling may
    // push a channel up by 1, and `Pixmap::from_vec` would then reject it.
    for pixel in rgba.chunks_exact_mut(4) {
        let alpha = pixel[3];
        for channel in &mut pixel[..3] {
            *channel = (*channel).min(alpha);
        }
    }
    let size = tiny_skia::IntSize::from_wh(width, height)
        .ok_or_else(|| anyhow!("invalid quad size {width}x{height}"))?;
    Pixmap::from_vec(rgba, size).ok_or_else(|| anyhow!("readback bytes cannot form a Pixmap"))
}

/// `&[f32]` → `&[u8]` (little-endian). Pulling in a bytemuck dependency just for a constant array of four vertices is not worth it.
fn bytemuck_cast(values: &[f32]) -> &[u8] {
    // SAFETY: `f32` has no padding and no invariants; any bit pattern is a valid `u8`.
    unsafe {
        std::slice::from_raw_parts(values.as_ptr().cast::<u8>(), std::mem::size_of_val(values))
    }
}

#[cfg(all(test, feature = "gpu"))]
mod tests {
    use super::*;

    #[test]
    fn the_readback_row_padding_follows_the_copy_alignment() {
        assert_eq!(padded_bytes_per_row(64), 256);
        assert_eq!(padded_bytes_per_row(65), 512);
        assert_eq!(padded_bytes_per_row(1), 256);
    }

    #[test]
    fn the_box_downsample_averages_in_the_premultiplied_domain() {
        // 2×2 → 1×1: three fully transparent pixels plus one opaque white; the average is exactly 1/4 coverage.
        let rgba = vec![
            0, 0, 0, 0, 255, 255, 255, 255, //
            0, 0, 0, 0, 0, 0, 0, 0,
        ];
        assert_eq!(box_downsample(&rgba, 2, 2, 2), vec![64, 64, 64, 64]);
    }

    #[test]
    fn the_pixmap_conversion_repairs_a_rounding_overshoot() {
        let pixmap = into_pixmap(vec![200, 10, 10, 128], 1, 1).unwrap();
        assert_eq!(pixmap.data()[0], 128, "rgb is clamped to within alpha");
    }
}
