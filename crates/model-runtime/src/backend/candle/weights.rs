//! Parts of this file's implementation draw on speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/WeightLoading.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backend, model pack and transcription interface; the original upstream source attribution is retained.
//! Full original license text: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the source, see the root `THIRD_PARTY_NOTICES.md`.
//!
//! safetensors weight loading, plus load-time dequantization of MLX affine quantization.
//!
//! MLX quantization format: `weight` is packed uint32 (each u32 stores `32/bits` quantized values, low bits first), and `scales`/`biases` are grouped per `group_size` input dimensions. Dequantization gives `w = q * scale + bias`, which matches value for value the weights used internally by MLX `quantized_matmul`, so existing MLX model repositories can be reused directly without republishing the weights.

use anyhow::{Context, Result, bail};
use candle_core::{DType, Device, Tensor};
use std::collections::HashMap;
use std::path::Path;

/// Environment variable that forces the compute precision (for diagnostics).
pub const COMPUTE_DTYPE_ENV: &str = "CUCCUT_CANDLE_DTYPE";

pub struct WeightStore {
    values: HashMap<String, Tensor>,
    device: Device,
    compute_dtype: DType,
}

impl WeightStore {
    pub(crate) fn from_values(values: HashMap<String, Tensor>, device: &Device, compute_dtype: DType) -> Self {
        Self {
            values,
            device: device.clone(),
            compute_dtype,
        }
    }

    /// Reads all safetensors shards listed in `files` and strips the `thinker.` prefix.
    pub fn load(files: &[&Path], device: &Device) -> Result<Self> {
        if files.is_empty() {
            bail!("no safetensors files to load");
        }
        let mut values = HashMap::new();
        for path in files {
            for (key, value) in
                candle_core::safetensors::load(path, device).with_context(|| format!("loading weights from {}", path.display()))?
            {
                let normalized = key.strip_prefix("thinker.").unwrap_or(&key).to_owned();
                if values.insert(normalized.clone(), value).is_some() {
                    bail!("duplicate weight after normalization: {normalized}");
                }
            }
        }
        let compute_dtype = resolve_compute_dtype(device, &values)?;
        Ok(Self {
            values,
            device: device.clone(),
            compute_dtype,
        })
    }

    pub fn device(&self) -> &Device {
        &self.device
    }

    /// This model's compute precision: always f32 on CPU; on CUDA it keeps the checkpoint's own half precision.
    pub fn compute_dtype(&self) -> DType {
        self.compute_dtype
    }

    pub fn contains(&self, key: &str) -> bool {
        self.values.contains_key(key)
    }

    pub fn take(&mut self, key: &str) -> Result<Tensor> {
        self.values.remove(key).ok_or_else(|| anyhow::anyhow!("missing weight: {key}"))
    }

    pub fn take_optional(&mut self, key: &str) -> Option<Tensor> {
        self.values.remove(key)
    }

    /// Fetches a weight and converts it to f32 (upcasting from bf16/f16).
    pub fn take_f32(&mut self, key: &str) -> Result<Tensor> {
        Ok(self.take(key)?.to_dtype(DType::F32)?)
    }

    pub fn take_optional_f32(&mut self, key: &str) -> Result<Option<Tensor>> {
        self.take_optional(key).map(|tensor| Ok(tensor.to_dtype(DType::F32)?)).transpose()
    }

    /// Fetches a weight and converts it to this model's compute precision (on CPU this is equivalent to `take_f32`).
    pub fn take_compute(&mut self, key: &str) -> Result<Tensor> {
        Ok(self.take(key)?.to_dtype(self.compute_dtype)?)
    }

    pub fn take_optional_compute(&mut self, key: &str) -> Result<Option<Tensor>> {
        let dtype = self.compute_dtype;
        self.take_optional(key).map(|tensor| Ok(tensor.to_dtype(dtype)?)).transpose()
    }

    /// Linear/embedding layer weights: dequantized when the checkpoint has `scales`, otherwise just converted to the compute precision.
    ///
    /// Unlike the mlx backend, float weights are not re-quantized at runtime: the dequantized result goes straight into this model's compute precision, which avoids a quantized-matmul dependency on the candle side.
    pub fn take_dequantized(&mut self, prefix: &str, group_size: usize, bits: usize) -> Result<Tensor> {
        let weight = self.take(&format!("{prefix}.weight"))?;
        if let Some(scales) = self.take_optional(&format!("{prefix}.scales")) {
            let biases = self.take(&format!("{prefix}.biases"))?;
            let dequantized = dequantize_affine(&weight, &scales, &biases, group_size, bits)?;
            Ok(dequantized.to_dtype(self.compute_dtype)?)
        } else {
            Ok(weight.to_dtype(self.compute_dtype)?)
        }
    }

    pub fn remaining(&self) -> Vec<String> {
        let mut keys = self.values.keys().cloned().collect::<Vec<_>>();
        keys.sort();
        keys
    }
}

/// Chooses the compute precision. CPU is fixed at f32; CUDA keeps the checkpoint's own half precision
/// (bf16 for MOSS/Qwen3-ASR, f16 for the aligner), which halves VRAM use without adding extra
/// numeric conversions. `CUCCUT_CANDLE_DTYPE=f32|bf16|f16` can force an override, which helps when debugging precision issues.
fn resolve_compute_dtype(device: &Device, values: &HashMap<String, Tensor>) -> Result<DType> {
    if let Some(raw) = std::env::var_os(COMPUTE_DTYPE_ENV) {
        let raw = raw.to_string_lossy().trim().to_lowercase();
        return match raw.as_str() {
            "f32" | "float32" => Ok(DType::F32),
            "bf16" | "bfloat16" => Ok(DType::BF16),
            "f16" | "float16" => Ok(DType::F16),
            other => bail!("invalid {COMPUTE_DTYPE_ENV} value {other} (expected f32, bf16 or f16)"),
        };
    }
    if !device.is_cuda() {
        return Ok(DType::F32);
    }
    let mut float16 = 0_usize;
    let mut bfloat16 = 0_usize;
    for tensor in values.values() {
        match tensor.dtype() {
            DType::F16 => float16 += 1,
            DType::BF16 => bfloat16 += 1,
            _ => {}
        }
    }
    Ok(if float16 == 0 && bfloat16 == 0 {
        DType::F32
    } else if float16 > bfloat16 {
        DType::F16
    } else {
        DType::BF16
    })
}

/// MLX affine dequantization: `weight` is u32 of shape [rows, cols*bits/32], each u32 storing `32/bits` quantized values with low bits first; `scales`/`biases` are [rows, cols/group_size].
pub fn dequantize_affine(weight: &Tensor, scales: &Tensor, biases: &Tensor, group_size: usize, bits: usize) -> Result<Tensor> {
    // Consistent with the mlx backend's `Projection`: weights with scales accept only 4 or 8 bits; when the config does not declare quantization (treated as 16 bits), unpacking would only produce garbage.
    if !matches!(bits, 4 | 8) {
        bail!("unsupported quantization width: {bits} bits (weights with scales need a declared 4- or 8-bit quantization)");
    }
    if weight.dtype() != DType::U32 {
        bail!("quantized weights must be uint32, got {:?}", weight.dtype());
    }
    let dims = weight.dims();
    if dims.len() != 2 {
        bail!("quantized weights must be two-dimensional, got {dims:?}");
    }
    let values_per_word = 32 / bits;
    let rows = dims[0];
    let packed_columns = dims[1];
    let columns = packed_columns * values_per_word;
    if !columns.is_multiple_of(group_size) {
        bail!("quantized column count {columns} is not a multiple of the group size {group_size}");
    }
    let groups = columns / group_size;
    let device = weight.device().clone();
    let packed = weight.flatten_all()?.to_vec1::<u32>()?;
    let scales = scales.to_dtype(DType::F32)?.flatten_all()?.to_vec1::<f32>()?;
    let biases = biases.to_dtype(DType::F32)?.flatten_all()?.to_vec1::<f32>()?;
    if scales.len() != rows * groups || biases.len() != rows * groups {
        bail!(
            "scales/biases shape mismatch: expected {}×{groups}, got {} / {}",
            rows,
            scales.len(),
            biases.len()
        );
    }
    let mask = if bits == 32 { u32::MAX } else { (1_u32 << bits) - 1 };
    let mut output = vec![0.0_f32; rows * columns];
    // Each row is independent, so the expansion is split by row across threads: this scalar loop at load time was the bottleneck for large models.
    let threads = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(1)
        .clamp(1, rows.max(1));
    let rows_per_task = rows.div_ceil(threads).max(1);
    let chunk_length = (rows_per_task * columns).max(1);
    std::thread::scope(|scope| {
        for (task, output_rows) in output.chunks_mut(chunk_length).enumerate() {
            let first_row = task * rows_per_task;
            let task_rows = output_rows.len() / columns;
            let task_scales = &scales[first_row * groups..(first_row + task_rows) * groups];
            let task_biases = &biases[first_row * groups..(first_row + task_rows) * groups];
            let task_packed = &packed[first_row * packed_columns..(first_row + task_rows) * packed_columns];
            scope.spawn(move || {
                for row in 0..task_rows {
                    let row_scales = &task_scales[row * groups..(row + 1) * groups];
                    let row_biases = &task_biases[row * groups..(row + 1) * groups];
                    let row_packed = &task_packed[row * packed_columns..(row + 1) * packed_columns];
                    let row_output = &mut output_rows[row * columns..(row + 1) * columns];
                    for (word_index, word) in row_packed.iter().copied().enumerate() {
                        let base = word_index * values_per_word;
                        for offset in 0..values_per_word {
                            let column = base + offset;
                            let quantized = (word >> (offset * bits)) & mask;
                            let group = column / group_size;
                            row_output[column] = quantized as f32 * row_scales[group] + row_biases[group];
                        }
                    }
                }
            });
        }
    });
    Ok(Tensor::from_vec(output, (rows, columns), &device)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candle_core::Device;

    /// Hand-packs a 4-bit quantized matrix with MLX semantics, to verify the dequantization formula and bit order.
    #[test]
    fn dequantizes_hand_packed_affine_weights() {
        let device = Device::Cpu;
        // One row has 8 values (one u32), group_size 8: q = [0,1,2,…,7], low bits first.
        let mut word = 0_u32;
        for (offset, q) in (0..8_u32).enumerate() {
            word |= q << (offset * 4);
        }
        let weight = Tensor::from_vec(vec![word], (1, 1), &device).unwrap();
        let scales = Tensor::from_vec(vec![0.5_f32], (1, 1), &device).unwrap();
        let biases = Tensor::from_vec(vec![-1.0_f32], (1, 1), &device).unwrap();
        let dequantized = dequantize_affine(&weight, &scales, &biases, 8, 4).unwrap();
        let values = dequantized.flatten_all().unwrap().to_vec1::<f32>().unwrap();
        let expected = (0..8).map(|q| q as f32 * 0.5 - 1.0).collect::<Vec<_>>();
        assert_eq!(values, expected);
    }

    #[test]
    fn rejects_unsupported_bit_widths() {
        let device = Device::Cpu;
        let weight = Tensor::from_vec(vec![0_u32], (1, 1), &device).unwrap();
        let scales = Tensor::from_vec(vec![1.0_f32], (1, 1), &device).unwrap();
        let biases = Tensor::from_vec(vec![0.0_f32], (1, 1), &device).unwrap();
        assert!(dequantize_affine(&weight, &scales, &biases, 8, 5).is_err());
        // When the config does not declare quantization, it is treated as 16 bits: weights with scales are rejected too.
        assert!(dequantize_affine(&weight, &scales, &biases, 8, 16).is_err());
    }
}
