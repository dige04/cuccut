//! Reads one tensor at a time from the mapped MLX safetensors shards (ported from v2 `ccut-image-local::candle::weights`).
//!
//! candle's ordinary `safetensors::load` moves every tensor to the device at once. Image model weights are far larger than the VRAM of a typical GPU, so the lifetime of the mapping is deliberately kept separate from the tensor transfers. The only difference from v2: v2 scans `*.safetensors` in a directory, while this reads the files the caller fetched by manifest ([`crate::bundle::VerifiedFiles::require_extension_in`]).

use anyhow::{Context, Result, anyhow, bail};
use candle_core::safetensors::Load;
use candle_core::{DType, Device, Tensor};
use memmap2::{Mmap, MmapOptions};
use safetensors::SafeTensors;
use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};

use crate::backend::candle::weights::dequantize_affine;

struct Shard {
    path: PathBuf,
    data: Mmap,
}

/// The safetensors shards stay mapped in host virtual memory. Only the requested tensors are copied to the target device. Once a layer is done, the returned tensors are dropped and that device memory is released.
pub struct ShardedWeights {
    shards: Vec<Shard>,
    index: HashMap<String, usize>,
}

impl ShardedWeights {
    /// Opens the given shards (indexed after sorting by path).
    pub fn open(files: &[&Path]) -> Result<Self> {
        let mut paths = files.iter().map(|path| path.to_path_buf()).collect::<Vec<_>>();
        paths.sort();
        if paths.is_empty() {
            bail!("no safetensors weights");
        }
        let mut shards = Vec::with_capacity(paths.len());
        let mut index = HashMap::new();
        for path in paths {
            let file = File::open(&path).with_context(|| format!("open {}", path.display()))?;
            // SAFETY: the mapping is read-only; the file stays open while the mapping is made, and CucCut's code does not modify the model weights.
            let data = unsafe { MmapOptions::new().map(&file) }.with_context(|| format!("map {}", path.display()))?;
            let tensors = SafeTensors::deserialize(&data).with_context(|| format!("parse {}", path.display()))?;
            for key in tensors.names() {
                if index.insert(key.to_owned(), shards.len()).is_some() {
                    bail!("duplicate weight key: {key}");
                }
            }
            drop(tensors);
            shards.push(Shard { path, data });
        }
        Ok(Self { shards, index })
    }

    pub fn contains(&self, key: &str) -> bool {
        self.index.contains_key(key)
    }

    fn shard(&self, key: &str) -> Result<&Shard> {
        self.shards
            .get(*self.index.get(key).ok_or_else(|| anyhow!("missing weight: {key}"))?)
            .context("weight shard index out of range")
    }

    /// Looks only at shapes and types; allocates no device tensors.
    pub fn metadata(&self, key: &str) -> Result<(Vec<usize>, safetensors::Dtype)> {
        let shard = self.shard(key)?;
        let tensors = SafeTensors::deserialize(&shard.data)?;
        let view = tensors.tensor(key)?;
        Ok((view.shape().to_vec(), view.dtype()))
    }

    pub fn load(&self, key: &str, device: &Device) -> Result<Tensor> {
        let shard = self.shard(key)?;
        let tensors = SafeTensors::deserialize(&shard.data).with_context(|| format!("parse {}", shard.path.display()))?;
        tensors
            .tensor(key)?
            .load(device)
            .with_context(|| format!("read weight {key} ({})", shard.path.display()))
    }

    /// MLX affine-quantized matrices are packed u32 values plus per-group scales and biases. Only this one matrix is dequantized in host memory, and the result is then moved to the device with `dtype`. The temporary allocations are freed when it returns.
    pub fn linear(&self, prefix: &str, input: usize, device: &Device, dtype: DType) -> Result<Tensor> {
        let key = format!("{prefix}.weight");
        let weight = self.load(&key, &Device::Cpu)?;
        if !self.contains(&format!("{prefix}.scales")) {
            return Ok(weight.to_dtype(dtype)?.to_device(device)?);
        }
        let scales = self.load(&format!("{prefix}.scales"), &Device::Cpu)?;
        let biases = self.load(&format!("{prefix}.biases"), &Device::Cpu)?;
        let (rows, columns) = weight.dims2()?;
        let (scale_rows, groups) = scales.dims2()?;
        if groups == 0 || rows != scale_rows || !input.is_multiple_of(groups) {
            bail!("{prefix}: quantization group shape does not match input dimension {input}");
        }
        let packed_bits = columns.checked_mul(32).context("quantized dimension overflow")?;
        if !packed_bits.is_multiple_of(input) {
            bail!("{prefix}: packed column count does not match input dimension {input}");
        }
        let bits = packed_bits / input;
        if !matches!(bits, 4 | 8) {
            bail!("{prefix}: quantization bit width {bits} is not supported");
        }
        let group = input / groups;
        let dense = dequantize_affine(&weight, &scales, &biases, group, bits)?;
        Ok(dense.to_dtype(dtype)?.to_device(device)?)
    }

    /// Word embeddings pick rows by the prompt's tokens first and only then are dequantized. Expanding the whole Qwen3-VL vocabulary would take several GB of host memory, while a prompt uses only a few dozen rows.
    pub fn embedding_rows(&self, prefix: &str, ids: &[u32], width: usize, device: &Device, dtype: DType) -> Result<Tensor> {
        let weight = self.load(&format!("{prefix}.weight"), &Device::Cpu)?;
        let rows = weight.dim(0)?;
        if ids.iter().any(|&id| id as usize >= rows) {
            bail!("{prefix}: token ID exceeds vocabulary size {rows}");
        }
        let indices = Tensor::from_slice(ids, ids.len(), &Device::Cpu)?;
        let selected = weight.index_select(&indices, 0)?;
        drop(weight);
        if !self.contains(&format!("{prefix}.scales")) {
            if selected.dim(1)? != width {
                bail!("{prefix}: embedding dimension does not match");
            }
            return Ok(selected.to_dtype(dtype)?.to_device(device)?);
        }
        let scales = self.load(&format!("{prefix}.scales"), &Device::Cpu)?.index_select(&indices, 0)?;
        let biases = self.load(&format!("{prefix}.biases"), &Device::Cpu)?.index_select(&indices, 0)?;
        let packed_bits = selected.dim(1)?.checked_mul(32).context("embedding dimension overflow")?;
        if !packed_bits.is_multiple_of(width) {
            bail!("{prefix}: packed embedding dimension does not match");
        }
        let bits = packed_bits / width;
        if !matches!(bits, 4 | 8) || scales.dim(1)? == 0 || !width.is_multiple_of(scales.dim(1)?) {
            bail!("{prefix}: embedding quantization config is not supported");
        }
        let dense = dequantize_affine(&selected, &scales, &biases, width / scales.dim(1)?, bits)?;
        Ok(dense.to_dtype(dtype)?.to_device(device)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_tensor(path: &Path, key: &str, dtype: &str, shape: &[usize], body: &[u8]) {
        let mut header = format!(
            "{{\"{key}\":{{\"dtype\":\"{dtype}\",\"shape\":{shape:?},\"data_offsets\":[0,{}]}}}}",
            body.len()
        );
        while !header.len().is_multiple_of(8) {
            header.push(' ');
        }
        let mut bytes = (header.len() as u64).to_le_bytes().to_vec();
        bytes.extend_from_slice(header.as_bytes());
        bytes.extend_from_slice(body);
        std::fs::write(path, bytes).unwrap();
    }

    fn open(dir: &Path, names: &[&str]) -> Result<ShardedWeights> {
        let paths = names.iter().map(|name| dir.join(name)).collect::<Vec<_>>();
        ShardedWeights::open(&paths.iter().map(PathBuf::as_path).collect::<Vec<_>>())
    }

    #[test]
    fn reads_only_requested_tensor_from_mapped_shards() {
        let dir = tempfile::tempdir().unwrap();
        write_tensor(
            &dir.path().join("model.safetensors"),
            "test.weight",
            "F32",
            &[1, 2],
            &[0, 0, 128, 63, 0, 0, 0, 64],
        );
        let weights = open(dir.path(), &["model.safetensors"]).unwrap();
        assert!(weights.contains("test.weight"));
        assert!(!weights.contains("other.weight"));
        assert_eq!(weights.metadata("test.weight").unwrap().0, vec![1, 2]);
        assert_eq!(
            weights.load("test.weight", &Device::Cpu).unwrap().to_vec2::<f32>().unwrap(),
            vec![vec![1.0, 2.0]]
        );
    }

    #[test]
    fn expands_mlx_four_bit_affine_matrix_on_cpu() {
        let dir = tempfile::tempdir().unwrap();
        // 8 low-bit-first 4-bit values (0..7), in groups of 8.
        let packed = (0..8_u32).fold(0_u32, |word, q| word | (q << (4 * q)));
        write_tensor(
            &dir.path().join("a.safetensors"),
            "layer.weight",
            "U32",
            &[1, 1],
            &packed.to_le_bytes(),
        );
        write_tensor(
            &dir.path().join("b.safetensors"),
            "layer.scales",
            "F32",
            &[1, 1],
            &0.5_f32.to_le_bytes(),
        );
        write_tensor(
            &dir.path().join("c.safetensors"),
            "layer.biases",
            "F32",
            &[1, 1],
            &1.0_f32.to_le_bytes(),
        );
        let weights = open(dir.path(), &["a.safetensors", "b.safetensors", "c.safetensors"]).unwrap();
        let dense = weights.linear("layer", 8, &Device::Cpu, DType::F32).unwrap();
        assert_eq!(
            dense.to_vec2::<f32>().unwrap(),
            vec![(0..8).map(|n| 1.0 + n as f32 * 0.5).collect::<Vec<_>>()]
        );
    }

    #[test]
    fn selects_quantized_embedding_rows_before_expansion() {
        let dir = tempfile::tempdir().unwrap();
        let words = [0x7654_3210_u32, 0x7777_7777];
        let packed = words.iter().flat_map(|word| word.to_le_bytes()).collect::<Vec<_>>();
        write_tensor(&dir.path().join("a.safetensors"), "embed.weight", "U32", &[2, 1], &packed);
        write_tensor(
            &dir.path().join("b.safetensors"),
            "embed.scales",
            "F32",
            &[2, 1],
            &[0.5_f32.to_le_bytes(), 0.5_f32.to_le_bytes()].concat(),
        );
        write_tensor(
            &dir.path().join("c.safetensors"),
            "embed.biases",
            "F32",
            &[2, 1],
            &[1.0_f32.to_le_bytes(), 1.0_f32.to_le_bytes()].concat(),
        );
        let weights = open(dir.path(), &["a.safetensors", "b.safetensors", "c.safetensors"]).unwrap();
        let selected = weights
            .embedding_rows("embed", &[1, 0, 1], 8, &Device::Cpu, DType::F32)
            .unwrap()
            .to_vec2::<f32>()
            .unwrap();
        assert_eq!(selected[0], vec![4.5; 8]);
        assert_eq!(selected[1], (0..8).map(|n| 1.0 + n as f32 * 0.5).collect::<Vec<_>>());
        assert_eq!(selected[2], selected[0]);
        assert!(weights.embedding_rows("embed", &[2], 8, &Device::Cpu, DType::F32).is_err());
    }

    #[test]
    fn rejects_duplicate_tensor_keys_across_shards() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["a.safetensors", "b.safetensors"] {
            write_tensor(&dir.path().join(name), "same.weight", "F32", &[1], &1.0_f32.to_le_bytes());
        }
        let error = open(dir.path(), &["a.safetensors", "b.safetensors"]).err().unwrap();
        assert!(error.to_string().contains("duplicate weight key"), "{error}");
        assert!(ShardedWeights::open(&[]).is_err());
    }
}
