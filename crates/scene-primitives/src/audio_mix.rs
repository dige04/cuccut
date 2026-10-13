//! BCF mixing and mastering declarations (spec §4 document-level `audio`, and the `fadeIn` / `fadeOut` / `pan` / `bus` of audio clips in §8.4, plus `muted` on audio tracks). This only parses and provides defaults, and does not touch sampling: the mixing chain lives in the host (the `audio` module of `ccut-render`).
//!
//! Mixing order (the host must follow it): clip gain and keyframes → fade in/out → panning → sum by bus → ducking (speech activity on the `from` bus pulls down the `to` bus) → bus gain → sum → mastering (loudness normalization and true-peak limiting alternating over three rounds).

use std::collections::BTreeMap;

use anyhow::{Result, anyhow, bail};
use serde_json::Value;

use crate::json::JsonExt;

/// Bus name used when no `bus` is written and the bus cannot be inferred from the track id.
pub const MAIN_BUS: &str = "main";

/// Ducking defaults: attack 20 ms, release 350 ms (the same defaults as `duck` in `ccut-score`).
pub const DUCK_ATTACK: f64 = 0.02;
pub const DUCK_RELEASE: f64 = 0.35;
/// Mastering defaults: −16 LUFS, −1.2 dBTP (the same defaults as the `ccut-score` preview mastering).
pub const MASTER_LUFS: f64 = -16.0;
pub const MASTER_TRUE_PEAK: f64 = -1.2;

/// Infer the default bus from a track id: `score-<bus>` → `<bus>`; otherwise, for ids containing `-`, take the part before the first `-` (`vo-sea` → `vo`);
/// tracks without `-`, tracks with no written id (`#<index>`), and clips expanded from `withAudio` → [`MAIN_BUS`].
pub fn default_bus(track: Option<&str>) -> String {
    let Some(id) = track.filter(|id| !id.starts_with('#')) else {
        return MAIN_BUS.to_string();
    };
    if let Some(rest) = id.strip_prefix("score-").filter(|r| !r.is_empty()) {
        return rest.to_string();
    }
    match id.split_once('-') {
        Some((head, _)) if !head.is_empty() => head.to_string(),
        _ => MAIN_BUS.to_string(),
    }
}

/// One ducking rule: when the `from` bus has sound, every bus in `to` is lowered by `depth_db`.
#[derive(Debug, Clone, PartialEq)]
pub struct Duck {
    pub from: String,
    pub to: Vec<String>,
    pub depth_db: f64,
    pub attack: f64,
    pub release: f64,
}

/// Mastering target.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MasterTarget {
    pub lufs: f64,
    pub true_peak: f64,
}

/// Document-level `audio`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct DocAudio {
    /// Bus gain (dB); buses not listed are 0 dB.
    pub buses: BTreeMap<String, f64>,
    pub duck: Vec<Duck>,
    pub master: Option<MasterTarget>,
}

impl DocAudio {
    /// Gain of a given bus (dB).
    pub fn bus_gain_db(&self, bus: &str) -> f64 {
        self.buses.get(bus).copied().unwrap_or(0.0)
    }

    /// Parse the document-level `audio` (absent or `null` gives `None`).
    pub fn parse(v: Option<&Value>) -> Result<Option<Self>> {
        let Some(v) = v.filter(|v| !v.is_null()) else {
            return Ok(None);
        };
        let obj = v
            .as_object()
            .ok_or_else(|| anyhow!("schema: audio must be an object"))?;
        for key in obj.keys() {
            if !["buses", "duck", "master"].contains(&key.as_str()) {
                bail!("schema: audio.{key} is not recognized (buses / duck / master)");
            }
        }
        let num = |v: &Value, path: &str| -> Result<f64> {
            v.as_f64()
                .filter(|x| x.is_finite())
                .ok_or_else(|| anyhow!("schema: {path} must be a finite number"))
        };
        let mut out = DocAudio::default();
        if let Some(buses) = v.get_("buses").filter(|b| !b.is_null()) {
            let buses = buses
                .as_object()
                .ok_or_else(|| anyhow!("schema: audio.buses must be an object"))?;
            for (name, spec) in buses {
                let g = spec
                    .get_("gainDb")
                    .ok_or_else(|| anyhow!("schema: audio.buses.{name}.gainDb is missing"))?;
                out.buses
                    .insert(name.clone(), num(g, &format!("audio.buses.{name}.gainDb"))?);
            }
        }
        if let Some(duck) = v.get_("duck").filter(|d| !d.is_null()) {
            let duck = duck
                .as_array()
                .ok_or_else(|| anyhow!("schema: audio.duck must be an array"))?;
            for (k, d) in duck.iter().enumerate() {
                let path = format!("audio.duck[{k}]");
                let from = d
                    .gstr("from")
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| anyhow!("schema: {path}.from must be a bus name"))?
                    .to_string();
                let to: Vec<String> = match d.get_("to") {
                    Some(Value::String(s)) => vec![s.clone()],
                    Some(Value::Array(a)) => a
                        .iter()
                        .map(|x| {
                            x.as_str()
                                .map(str::to_owned)
                                .ok_or_else(|| anyhow!("schema: {path}.to must be an array of bus names"))
                        })
                        .collect::<Result<_>>()?,
                    _ => bail!("schema: {path}.to must be an array of bus names"),
                };
                if to.is_empty() || to.contains(&from) {
                    bail!("schema: {path}.to must not be empty or contain the from bus");
                }
                let depth_db = num(
                    d.get_("depthDb")
                        .ok_or_else(|| anyhow!("schema: {path}.depthDb is missing"))?,
                    &format!("{path}.depthDb"),
                )?;
                let time = |key: &str, default: f64| -> Result<f64> {
                    match d.get_(key) {
                        None | Some(Value::Null) => Ok(default),
                        Some(x) => {
                            let t = num(x, &format!("{path}.{key}"))?;
                            if t <= 0.0 {
                                bail!("schema: {path}.{key} must be > 0");
                            }
                            Ok(t)
                        }
                    }
                };
                out.duck.push(Duck {
                    from,
                    to,
                    depth_db,
                    attack: time("attack", DUCK_ATTACK)?,
                    release: time("release", DUCK_RELEASE)?,
                });
            }
        }
        if let Some(m) = v.get_("master").filter(|m| !m.is_null()) {
            if !m.is_object() {
                bail!("schema: audio.master must be an object");
            }
            let lufs = match m.get_("lufs") {
                None | Some(Value::Null) => MASTER_LUFS,
                Some(x) => num(x, "audio.master.lufs")?,
            };
            let true_peak = match m.get_("truePeak") {
                None | Some(Value::Null) => MASTER_TRUE_PEAK,
                Some(x) => num(x, "audio.master.truePeak")?,
            };
            if !(-70.0..=0.0).contains(&lufs) || !(-20.0..=0.0).contains(&true_peak) {
                bail!("schema: audio.master is out of range (lufs −70..0, truePeak −20..0)");
            }
            out.master = Some(MasterTarget { lufs, true_peak });
        }
        Ok(Some(out))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_bus_from_track_id() {
        assert_eq!(default_bus(Some("score-music")), "music");
        assert_eq!(default_bus(Some("vo-sea")), "vo");
        assert_eq!(default_bus(Some("vo")), MAIN_BUS);
        assert_eq!(default_bus(Some("#2")), MAIN_BUS);
        assert_eq!(default_bus(Some("score-")), "score");
        assert_eq!(default_bus(None), MAIN_BUS);
    }

    #[test]
    fn parses_buses_duck_master_with_defaults() {
        let a = DocAudio::parse(Some(&json!({
            "buses": {"music": {"gainDb": -3}},
            "duck": [{"from": "vo", "to": ["music", "amb"], "depthDb": 10}],
            "master": {"lufs": -16}
        })))
        .unwrap()
        .unwrap();
        assert_eq!(a.bus_gain_db("music"), -3.0);
        assert_eq!(a.bus_gain_db("sfx"), 0.0);
        assert_eq!(a.duck[0].attack, DUCK_ATTACK);
        assert_eq!(a.duck[0].release, DUCK_RELEASE);
        assert_eq!(
            a.master,
            Some(MasterTarget {
                lufs: -16.0,
                true_peak: MASTER_TRUE_PEAK
            })
        );
        assert_eq!(DocAudio::parse(None).unwrap(), None);
        assert_eq!(DocAudio::parse(Some(&Value::Null)).unwrap(), None);
    }

    #[test]
    fn rejects_bad_shapes() {
        for bad in [
            json!([]),
            json!({"mix": {}}),
            json!({"buses": {"a": {}}}),
            json!({"duck": [{"from": "vo", "to": [], "depthDb": 6}]}),
            json!({"duck": [{"from": "vo", "to": ["vo"], "depthDb": 6}]}),
            json!({"duck": [{"from": "vo", "to": ["m"], "depthDb": 6, "attack": 0}]}),
            json!({"master": {"lufs": 3}}),
        ] {
            assert!(DocAudio::parse(Some(&bad)).is_err(), "{bad}");
        }
    }
}
