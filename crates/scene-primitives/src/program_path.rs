//! Path rules for the `program` asset (spec §6.5.3): `src`, `imports`, `files`, relative imports inside modules, and `asset()` are all bounded by the **directory containing the document**. `..` may not be used to climb out.
//!
//! There is only one copy of the normalization and out-of-bounds message. `ccut lint` checks the `src` / `imports` / `files` that are visible statically, while load time (ccut-compile's module graph, ccut-render's `asset()`) checks the paths that only become known at evaluation time. Both report the same code [`PATH_ESCAPE`] with the same wording. These are pure functions and do not touch the disk. A symlink that points outside the directory is a different matter: it is only visible when reading from disk, and load time reports it as `program-invalid`.

/// The path uses `..` to climb out of the document's directory.
pub const PATH_ESCAPE: &str = "program-path-escape";

/// The three kinds of path rejected by [`normalize`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathError {
    /// Uses `\` as the separator.
    Backslash,
    /// `..` climbed out of the document's directory (reports [`PATH_ESCAPE`]).
    Escape,
    /// Nothing is left after normalization.
    Empty,
}

impl PathError {
    /// Explanation without a code. For the full wording of [`PathError::Escape`], use [`escape_message`].
    pub fn describe(self, rel: &str) -> String {
        match self {
            PathError::Backslash => format!("路径 \"{rel}\" 须用 / 分隔"),
            PathError::Escape => format!("路径 \"{rel}\" 越出文档所在目录"),
            PathError::Empty => format!("路径 \"{rel}\" 为空"),
        }
    }
}

/// `rel` within `dir` → normalized name. `dir` is a normalized directory name under the document directory (`""` is the document directory itself). The result is `/`-separated, has no `.` / `..`, and does not climb out of the document directory.
pub fn normalize(dir: &str, rel: &str) -> Result<String, PathError> {
    if rel.contains('\\') {
        return Err(PathError::Backslash);
    }
    let mut parts: Vec<&str> = dir.split('/').filter(|p| !p.is_empty()).collect();
    for part in rel.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if parts.pop().is_none() {
                    return Err(PathError::Escape);
                }
            }
            part => parts.push(part),
        }
    }
    if parts.is_empty() {
        return Err(PathError::Empty);
    }
    Ok(parts.join("/"))
}

/// Only asks "does it use `..` to climb out of the document directory?" Other faults such as backslashes or an empty path do not count, since each has its own code.
pub fn escapes(dir: &str, rel: &str) -> bool {
    normalize(dir, rel) == Err(PathError::Escape)
}

/// Message for [`PATH_ESCAPE`] (without the code): which boundary it is, which path violated it, and how to fix it.
/// `subject` says where the path came from, e.g. `src`, `imports.remotion`, `files[0]`, `import in film/Film.tsx`, `asset()`.
pub fn escape_message(subject: &str, rel: &str) -> String {
    format!(
        "{subject} 的路径 \"{rel}\" 用 .. 越出了文档所在目录。program 的 src、imports、files、\
         模块里的相对 import 与 asset() 都以文档（.ccut.tsx / .ccut.json）所在的目录为边界，\
         不能走到它外面；改法：把文档放到项目根，或放到模块旁边，让路径不必用 .. 出去"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_stays_inside_the_document_directory() {
        assert_eq!(normalize("a/b", "./c").unwrap(), "a/b/c");
        assert_eq!(normalize("a/b", "../c.ts").unwrap(), "a/c.ts");
        assert_eq!(normalize("", "./x/./y").unwrap(), "x/y");
        assert_eq!(normalize("a", "../../x"), Err(PathError::Escape));
        assert_eq!(normalize("", ".."), Err(PathError::Escape));
        assert_eq!(normalize("", "../film/X.tsx"), Err(PathError::Escape));
        assert_eq!(normalize("", "a\\b"), Err(PathError::Backslash));
        assert_eq!(normalize("", "./"), Err(PathError::Empty));
        // Going down and then back up without leaving the boundary is not an escape
        assert_eq!(normalize("", "film/../x.tsx").unwrap(), "x.tsx");
        assert!(escapes("", "../x"));
        assert!(!escapes("", "a\\..\\x"), "反斜杠是另一种错");
    }

    #[test]
    fn the_escape_message_names_the_boundary_the_path_and_the_fix() {
        let message = escape_message("src", "../film/X.tsx");
        assert!(message.contains("\"../film/X.tsx\""));
        assert!(message.contains("文档所在目录"));
        assert!(message.contains("项目根"));
        assert!(message.contains("模块旁边"));
    }
}
