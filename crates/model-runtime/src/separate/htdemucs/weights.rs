//! Sub-model weight table: slices out one set from the bag's full safetensors by the `model_{i}.` prefix,
//! takes keys one at a time and upcasts them to f32; after the model is built, no keys may remain (corresponding to Swift `verify: .all`).

use super::tensor::{Array, Dtype};
use anyhow::{Context, Result, bail};
use std::collections::HashMap;

pub struct WeightStore {
    prefix: String,
    weights: HashMap<String, Array>,
}

impl WeightStore {
    /// Moves all keys in `all` that start with `prefix` out of it (stripping the prefix).
    pub fn split(all: &mut HashMap<String, Array>, prefix: &str) -> Self {
        let keys: Vec<String> = all.keys().filter(|k| k.starts_with(prefix)).cloned().collect();
        let mut weights = HashMap::with_capacity(keys.len());
        for key in keys {
            if let Some(value) = all.remove(&key) {
                weights.insert(key[prefix.len()..].to_string(), value);
            }
        }
        Self {
            prefix: prefix.to_string(),
            weights,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.weights.is_empty()
    }

    /// Takes one weight and converts it to f32 (the reference implementation also upcasts fp16 weights to float32 for computation).
    ///
    /// Evaluated one at a time: weights are materialized as resident f32 at load time (one short command buffer per tensor), and the fp16 original is released right away;
    /// this way the cost and resident memory of `model.load` are real, and the first window no longer carries the loading overhead.
    pub fn take(&mut self, key: &str) -> Result<Array> {
        let value = self.weights.remove(key).with_context(|| format!("缺少权重 {}{key}", self.prefix))?;
        let value = if value.dtype() == Dtype::Float32 {
            value
        } else {
            value.as_dtype(Dtype::Float32)?
        };
        value.eval()?;
        Ok(value)
    }

    /// Takes the weight and validates its shape.
    pub fn take_shape(&mut self, key: &str, expected: &[i32]) -> Result<Array> {
        let value = self.take(key)?;
        if value.shape() != expected {
            bail!("权重 {}{key} 形状 {:?} 与期望 {:?} 不符", self.prefix, value.shape(), expected);
        }
        Ok(value)
    }

    /// Called after the model is built: any remaining keys mean the module tree does not match the exported file.
    pub fn finish(self) -> Result<()> {
        if self.weights.is_empty() {
            return Ok(());
        }
        let mut keys: Vec<&String> = self.weights.keys().collect();
        keys.sort();
        let preview: Vec<String> = keys.iter().take(8).map(|k| k.to_string()).collect();
        bail!("{} 有 {} 个权重未被使用，例如 {:?}", self.prefix, self.weights.len(), preview);
    }
}
