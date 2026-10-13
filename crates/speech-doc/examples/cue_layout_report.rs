//! Reports the `autoBreaks` layout quality of **any saved transcript** (plan M6.1b item 4).
//!
//! ```text
//! cargo run -p ccut-flow-core --example cue_layout_report -- <标签> <transcript.json> [<标签> <transcript.json> …]
//! cargo run -p ccut-flow-core --example cue_layout_report -- --optimize <标签> <transcript.json>
//! ```
//!
//! Metrics use **exactly the same basis** as `segment_local_f1 firstscreen` (cue count, longest CPL, over-wide, over 20 CPS, peak CPS, seam count, dangling-seam rate). The only difference: that example runs SaT in-process and builds its own input, while this one only reads files, so it can measure the real output of the three **CLI** paths `ccut segment --boundary-scorer off | local | hybrid`. **No models are loaded.**

use std::path::Path;

use speech_doc::atomize::{clause_end_char, count_cps_chars};
use speech_doc::cue::derive_cues;
use speech_doc::doc::TranscriptDoc;
use speech_doc::layout::apply_balanced_cues;
use speech_doc::layout::cue_layout_stats;
use speech_doc::layout_profile::cue_params_for_doc;
use speech_doc::seam::ends_dangling;

fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    // Recomputed in memory only, so real long scripts can be compared before and after; never writes back to the input file.
    let optimize = args.first().is_some_and(|arg| arg == "--optimize");
    if optimize {
        args.remove(0);
    }
    if args.len() < 2 || args.len() % 2 != 0 {
        eprintln!(
            "用法: cue_layout_report [--optimize] <标签> <transcript.json> [<标签> <transcript.json> …]"
        );
        std::process::exit(2);
    }
    println!(
        "{:<26} {:>5} {:>5} {:>5} {:>7} {:>8} {:>5} {:>8}",
        "档", "Cue", "CPL", "超宽", "超20CPS", "峰CPS", "缝", "悬垂率"
    );
    for pair in args.chunks(2) {
        let text = std::fs::read_to_string(Path::new(&pair[1])).unwrap_or_else(|error| {
            eprintln!("读取 {} 失败：{error}", pair[1]);
            std::process::exit(2);
        });
        let mut doc: TranscriptDoc = serde_json::from_str(&text).unwrap_or_else(|error| {
            eprintln!("{} 反序列化失败：{error}", pair[1]);
            std::process::exit(2);
        });
        let params = cue_params_for_doc(&doc);
        if optimize {
            apply_balanced_cues(&mut doc, &params);
        }
        let stats = cue_layout_stats(&doc, &params);
        let cues = derive_cues(&doc, &params);
        let mut over_cps = 0usize;
        let mut max_cps = 0.0f64;
        for cue in &cues {
            let seconds = (cue.end - cue.start).max(0.001);
            let cps = count_cps_chars(&cue.text(&doc)) as f64 / seconds;
            max_cps = max_cps.max(cps);
            if cps > 20.0 {
                over_cps += 1;
            }
        }
        let mut seams = 0usize;
        let mut dangling = 0usize;
        for cue in cues.iter().take(cues.len().saturating_sub(1)) {
            let Some(&index) = cue.word_indices.last() else {
                continue;
            };
            seams += 1;
            let word = &doc.words[index].text;
            if clause_end_char(word).is_none() && ends_dangling(word) {
                dangling += 1;
            }
        }
        println!(
            "{:<26} {:>5} {:>5} {:>5} {:>7} {:>8.1} {:>5} {:>8.3}",
            pair[0],
            stats.cues,
            stats.longest_width,
            stats.over_width,
            over_cps,
            max_cps,
            seams,
            dangling as f64 / seams.max(1) as f64,
        );
    }
}
