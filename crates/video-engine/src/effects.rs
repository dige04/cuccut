//! Effects (video format spec §3.8) and cropping (§3.5).
//!
//! An effect is v2's `fx`: a fixed set of fields, applied in a fixed order. `setEffects` replaces the whole set. The valid range of each field's value is checked by `elements::check_item` through `timeline`.

use serde_json::json;

use crate::error::{EngineResult, ErrorBody, msg};
use crate::model::*;
use crate::ops::{editable_item, not_applicable};
use crate::state::VideoState;

/// Replaces the `fx` of the whole instance. `None` or an entirely empty `fx` removes the effects.
pub(crate) fn set_effects(state: &mut VideoState, sequence_id: Option<&str>, item_id: &str, fx: Option<&Fx>) -> EngineResult<()> {
    let item = editable_item(state, sequence_id, item_id)?;
    let slot = item
        .fx_mut()
        .ok_or_else(|| not_applicable(
            item_id,
            msg!("engine.effectsNotVisual", "is not visual media or a composition, so it cannot have effects"),
        ))?;
    *slot = fx.filter(|fx| !fx.is_empty()).cloned();
    crate::elements::check_item(state, item_id)
}

pub(crate) fn check_crop(item_id: &str, crop: &Crop) -> EngineResult<()> {
    if !crop.is_valid() {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.cropRange",
            "Each crop edge must be within [0, 1), and left + right and top + bottom must each be less than 1"
        ))
            .entities([item_id])
            .details(json!({ "crop": crop })));
    }
    Ok(())
}

/// `crop` in `setStyle`: `null` removes it; all four sides at 0 is also equivalent to removing it. Only videos and images can be cropped.
pub(crate) fn apply_crop(item: &mut TimelineItem, item_id: &str, crop: Option<&Crop>) -> EngineResult<()> {
    if let Some(c) = crop {
        check_crop(item_id, c)?;
    }
    let slot = match item {
        TimelineItem::Video(v) => &mut v.crop,
        TimelineItem::Image(i) => &mut i.crop,
        _ => return Err(not_applicable(item_id, msg!("engine.cropNotVideoOrImage", "is not a video or image, so it cannot be cropped"))),
    };
    *slot = crop.filter(|c| !c.is_empty()).cloned();
    Ok(())
}
