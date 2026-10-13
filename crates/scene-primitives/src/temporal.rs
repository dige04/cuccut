use anyhow::{Result, anyhow, bail};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EchoMode {
    Over,
    Average,
}
#[derive(Debug, Clone)]
pub struct Echo {
    pub mode: EchoMode,
    pub samples: Vec<(f64, f64)>,
}
impl Echo {
    pub fn parse(value: &Value) -> Result<Self> {
        let object = value
            .as_object()
            .ok_or_else(|| anyhow!("schema: echo must be an object"))?;
        if object
            .keys()
            .any(|k| !matches!(k.as_str(), "mode" | "samples"))
        {
            bail!("schema: echo has unknown fields");
        }
        let mode = match value.get("mode") {
            None => EchoMode::Over,
            Some(v) => match v.as_str() {
                Some("over") => EchoMode::Over,
                Some("average") => EchoMode::Average,
                _ => bail!("schema: echo.mode must be over|average"),
            },
        };
        let samples = value
            .get("samples")
            .and_then(Value::as_array)
            .filter(|v| !v.is_empty() && v.len() <= 16)
            .ok_or_else(|| anyhow!("schema: echo.samples must have 1..16 items"))?;
        let mut out = Vec::new();
        for sample in samples {
            let object = sample
                .as_object()
                .ok_or_else(|| anyhow!("schema: echo sample must be an object"))?;
            if object
                .keys()
                .any(|k| !matches!(k.as_str(), "offset" | "weight"))
            {
                bail!("schema: echo sample only accepts offset/weight");
            }
            let offset = sample
                .get("offset")
                .and_then(Value::as_f64)
                .filter(|v| v.is_finite() && (-10.0..=10.0).contains(v))
                .ok_or_else(|| anyhow!("schema: echo.offset must be within -10..10 seconds"))?;
            let weight = match sample.get("weight") {
                None => 1.0,
                Some(v) => v
                    .as_f64()
                    .filter(|v| v.is_finite() && *v >= 0.0 && *v <= 1_000_000.0)
                    .ok_or_else(|| anyhow!("schema: echo.weight is invalid"))?,
            };
            if mode == EchoMode::Over && weight > 1.0 {
                bail!("schema: over weight must be in 0..1");
            }
            out.push((offset, weight));
        }
        if out.iter().all(|(_, w)| *w == 0.0) {
            bail!("schema: echo needs at least one positive weight");
        }
        Ok(Self { mode, samples: out })
    }
}
