//! A model graph and separator for HTDemucs-FT, compiled against candle's tensor vocabulary (`tensor/candle.rs`) (see [`super`]).

#[path = "layers.rs"]
mod layers;
#[path = "model.rs"]
mod model;
#[path = "separator.rs"]
mod separator;
#[path = "tensor/candle.rs"]
mod tensor;
#[path = "transformer.rs"]
mod transformer;
#[path = "weights.rs"]
mod weights;

pub use separator::HtDemucs;
pub use tensor::use_device;
