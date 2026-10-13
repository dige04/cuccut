//! The element style catalogue: the styles, their order, default colors, dB windows and emission parameters for the waveform, progress bar and confetti, read from the built-in recipes in `motion`; rendering draws from the same set.
//!
//! Only these three catalogues are parsed (`motion::preset_registry::parse_builtin_catalogue`); other built-in recipes do not enter this WASM. Only the fields the UI needs for creating new elements and for the property page are exposed; drawing (the rest of the recipe parameters) is used only in the render core. Style names and palette titles are UI copy and stay in the UI.

use motion::MotionError;
use motion::preset_registry::{
    CatalogueKind, CatalogueRecipe, ConfettiBody, ProgressAspect, ProgressBody, VisualizerAspect, VisualizerBody, parse_builtin_catalogue,
    visualizer_style_aliases,
};
use serde::Serialize;
use serde_json::{Map, Value};

use crate::EntryError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Presets {
    progress: Vec<ProgressPreset>,
    visualizer: Vec<VisualizerPreset>,
    /// The old waveform style id → a style in the current catalogue (old projects still open and draw as before).
    visualizer_aliases: Map<String, Value>,
    confetti: Vec<ConfettiPreset>,
}

/// One progress bar style. `aspect`: `bar` uses the whole box, `square` takes the inscribed square within the box, and `frame` is a border covering the full frame.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPreset {
    id: String,
    aspect: &'static str,
    main_color: String,
    secondary_color: String,
    /// The number of palettes the property page offers (0–2).
    num_colors: u8,
}

/// One waveform style. Styles whose `hasControl` is false read the time domain; the dB window, smoothing and gain have no effect on them.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VisualizerPreset {
    id: String,
    aspect: &'static str,
    main_color: String,
    secondary_color: String,
    min_db: f64,
    max_db: f64,
    has_control: bool,
    num_colors: u8,
}

/// One confetti style: its palette, shape mix and default emission parameters (the property page's “follow recipe” falls back to these values).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfettiPreset {
    id: String,
    colors: Vec<String>,
    shapes: Vec<String>,
    /// The source id of the adapted work (`library/part`), which the property page shows for attribution.
    sources: Vec<String>,
    has_emitter_control: bool,
    emit: ConfettiEmit,
    emitters: Vec<ConfettiEmitter>,
    /// Emission direction (degrees; 90 is down, −90 is up).
    angle: f64,
    /// Emission fan angle (degrees).
    spread: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfettiEmit {
    mode: String,
    rate: f64,
    count: f64,
    interval: f64,
}

/// Emitter: the center in % of the box; it may carry its own direction.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfettiEmitter {
    x: f64,
    y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    angle: Option<f64>,
}

fn broken(message: String) -> EntryError {
    EntryError {
        code: "PRESET_CATALOGUE_INVALID",
        message,
    }
}

fn catalogue(kind: CatalogueKind) -> Result<Vec<CatalogueRecipe>, EntryError> {
    let recipes = parse_builtin_catalogue(kind).map_err(|error: MotionError| broken(error.to_string()))?;
    Ok(recipes.into_iter().filter(|recipe| recipe.available).collect())
}

fn progress(recipe: &CatalogueRecipe, body: &ProgressBody) -> ProgressPreset {
    ProgressPreset {
        id: recipe.id.clone(),
        aspect: match body.aspect {
            ProgressAspect::Bar => "bar",
            ProgressAspect::Square => "square",
            ProgressAspect::Frame => "frame",
        },
        main_color: body.default_main_color.clone(),
        secondary_color: body.default_secondary_color.clone(),
        num_colors: body.num_colors,
    }
}

fn visualizer(recipe: &CatalogueRecipe, body: &VisualizerBody) -> VisualizerPreset {
    VisualizerPreset {
        id: recipe.id.clone(),
        aspect: match body.aspect {
            VisualizerAspect::Free => "free",
            VisualizerAspect::Square => "square",
        },
        main_color: body.default_main_color.clone(),
        secondary_color: body.default_secondary_color.clone(),
        min_db: body.default_min_db,
        max_db: body.default_max_db,
        has_control: body.has_control,
        num_colors: body.num_colors,
    }
}

fn confetti(recipe: &CatalogueRecipe, body: &ConfettiBody) -> Result<ConfettiPreset, EntryError> {
    let params = &body.recipe;
    let missing = |key: &str| broken(format!("彩纸 {} 的配方缺 {key}", recipe.id));
    let number = |map: &Map<String, Value>, key: &str| map.get(key).and_then(Value::as_f64).ok_or_else(|| missing(key));
    let emit = params.object("emit").ok_or_else(|| missing("emit"))?;
    let emitters = params
        .array("emitters")
        .ok_or_else(|| missing("emitters"))?
        .iter()
        .map(|emitter| {
            let emitter = emitter.as_object().ok_or_else(|| missing("emitters[]"))?;
            Ok(ConfettiEmitter {
                x: number(emitter, "x")?,
                y: number(emitter, "y")?,
                angle: emitter.get("angle").and_then(Value::as_f64),
            })
        })
        .collect::<Result<Vec<_>, EntryError>>()?;
    Ok(ConfettiPreset {
        id: recipe.id.clone(),
        colors: body.palette.clone(),
        shapes: body.shapes.clone(),
        sources: body.sources.clone(),
        has_emitter_control: body.has_emitter_control,
        emit: ConfettiEmit {
            mode: emit
                .get("mode")
                .and_then(Value::as_str)
                .ok_or_else(|| missing("emit.mode"))?
                .to_owned(),
            rate: number(emit, "rate")?,
            count: number(emit, "count")?,
            interval: number(emit, "interval")?,
        },
        emitters,
        angle: params.number("angle").ok_or_else(|| missing("angle"))?,
        spread: params.number("spread").ok_or_else(|| missing("spread"))?,
    })
}

/// The input is not read (by convention pass `{}`); the result is the three catalogues (in catalogue order) and the old-name table for the waveform. `PRESET_CATALOGUE_INVALID` if the built-in recipes cannot be parsed.
pub fn element_presets(_input: &[u8]) -> Result<String, EntryError> {
    let presets = Presets {
        progress: catalogue(CatalogueKind::Progress)?
            .iter()
            .filter_map(|recipe| recipe.progress().map(|body| progress(recipe, body)))
            .collect(),
        visualizer: catalogue(CatalogueKind::Visualizer)?
            .iter()
            .filter_map(|recipe| recipe.visualizer().map(|body| visualizer(recipe, body)))
            .collect(),
        visualizer_aliases: visualizer_style_aliases()
            .iter()
            .map(|(old, new)| ((*old).to_owned(), Value::String((*new).to_owned())))
            .collect(),
        confetti: catalogue(CatalogueKind::Confetti)?
            .iter()
            .filter_map(|recipe| recipe.confetti().map(|body| confetti(recipe, body)))
            .collect::<Result<_, _>>()?,
    };
    Ok(serde_json::to_string(&presets).expect("catalog always serializes"))
}
