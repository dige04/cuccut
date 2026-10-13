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
            PathError::Backslash => format!("path \"{rel}\" must use / as the separator"),
            PathError::Escape => format!("path \"{rel}\" escapes the document's directory"),
            PathError::Empty => format!("path \"{rel}\" is empty"),
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
        "{subject} path \"{rel}\" uses .. and escapes the document's directory. The program's src, imports, \
         files, relative imports in modules and asset() paths are bounded by the directory that holds the \
         document (.ccut.tsx / .ccut.json) and cannot leave it. Fix: move the document to the project root, \
         or next to the module, so the path does not need to use .."
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
        assert!(!escapes("", "a\\..\\x"), "a backslash is a different error");
    }

    #[test]
    fn the_escape_message_names_the_boundary_the_path_and_the_fix() {
        let message = escape_message("src", "../film/X.tsx");
        assert!(message.contains("\"../film/X.tsx\""));
        assert!(message.contains("document's directory"));
        assert!(message.contains("project root"));
        assert!(message.contains("next to the module"));
    }
}
