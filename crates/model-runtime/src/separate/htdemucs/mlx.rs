//! A model graph and separator for HTDemucs-FT, compiled against the mlx tensor vocabulary (`tensor/mlx.rs`) (see [`super`]).

#[path = "layers.rs"]
mod layers;
#[path = "model.rs"]
mod model;
#[path = "separator.rs"]
mod separator;
#[path = "tensor/mlx.rs"]
mod tensor;
#[path = "transformer.rs"]
mod transformer;
#[path = "weights.rs"]
mod weights;

pub use separator::HtDemucs;
