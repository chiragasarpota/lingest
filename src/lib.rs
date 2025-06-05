use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;
use std::fs;
use std::path::Path;
use walkdir::{DirEntry, WalkDir};

#[napi(object)]
pub struct LingestOptions {
    pub cwd: String,
    pub output_path: String,
    pub ignore_globs: Vec<String>,
    pub include_globs: Vec<String>,
    pub no_tree: bool,
    pub dry_run: bool,
}

#[napi(object)]
pub struct LingestResult {
    pub tree: Option<String>,
    pub file_contents: Vec<FileContent>,
    pub processed_count: u32,
}

#[napi(object)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub error: Option<String>,
}

#[napi]
pub fn process_directory(options: LingestOptions) -> Result<LingestResult> {
    let cwd = Path::new(&options.cwd);
    let output_path = Path::new(&options.output_path);
    
    // Generate tree if needed
    let tree = if !options.no_tree {
        Some(generate_tree(
            cwd,
            cwd,
            "",
            &options.ignore_globs,
            &options.include_globs,
            output_path,
        ))
    } else {
        None
    };
    
    // Process file contents
    let (file_contents, processed_count) = process_files(
        cwd,
        &options.ignore_globs,
        &options.include_globs,
        output_path,
        options.dry_run,
    )?;
    
    Ok(LingestResult {
        tree,
        file_contents,
        processed_count,
    })
}

fn generate_tree(
    dir: &Path,
    base_path: &Path,
    prefix: &str,
    ignore_globs: &[String],
    include_globs: &[String],
    output_path: &Path,
) -> String {
    let mut tree = String::new();
    
    let mut entries: Vec<_> = match fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path() != output_path)
            .collect(),
        Err(_) => return tree,
    };
    
    // Sort directories first, then files
    entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });
    
    let total = entries.len();
    for (index, entry) in entries.iter().enumerate() {
        let path = entry.path();
        let relative_path = path.strip_prefix(base_path).unwrap_or(&path);
        let relative_str = relative_path.to_string_lossy().replace('\\', "/");
        
        if should_ignore(&relative_str, ignore_globs) {
            continue;
        }
        
        let is_last = index == total - 1;
        let connector = if is_last { "└── " } else { "├── " };
        
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            tree.push_str(prefix);
            tree.push_str(connector);
            tree.push_str(&name);
            tree.push_str("/\n");
            
            let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
            tree.push_str(&generate_tree(
                &path,
                base_path,
                &new_prefix,
                ignore_globs,
                include_globs,
                output_path,
            ));
        } else if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            if !include_globs.is_empty() && !matches_any(&relative_str, include_globs) {
                continue;
            }
            tree.push_str(prefix);
            tree.push_str(connector);
            tree.push_str(&name);
            tree.push('\n');
        }
    }
    
    tree
}

fn process_files(
    base_path: &Path,
    ignore_globs: &[String],
    include_globs: &[String],
    output_path: &Path,
    dry_run: bool,
) -> Result<(Vec<FileContent>, u32)> {
    let walker = WalkDir::new(base_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path() != output_path);
    
    let entries: Vec<DirEntry> = walker.collect();
    
    let file_contents: Vec<FileContent> = entries
        .par_iter()
        .filter_map(|entry| {
            let path = entry.path();
            let relative_path = path.strip_prefix(base_path).unwrap_or(path);
            let relative_str = relative_path.to_string_lossy().replace('\\', "/");
            
            // Check ignore patterns
            if should_ignore(&relative_str, ignore_globs) {
                return None;
            }
            
            // Check include patterns
            if !include_globs.is_empty() && !matches_any(&relative_str, include_globs) {
                return None;
            }
            
            if dry_run {
                Some(FileContent {
                    path: relative_str.clone(),
                    content: format!("[Dry Run] Content of {} would be here.", relative_str),
                    error: None,
                })
            } else {
                match fs::read_to_string(path) {
                    Ok(content) => Some(FileContent {
                        path: relative_str,
                        content,
                        error: None,
                    }),
                    Err(_) => Some(FileContent {
                        path: relative_str,
                        content: String::new(),
                        error: Some("Could not be read as UTF-8 text. Might be binary or encoding issue.".to_string()),
                    }),
                }
            }
        })
        .collect();
    
    let processed_count = file_contents.len() as u32;
    
    Ok((file_contents, processed_count))
}

fn should_ignore(path: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        glob::Pattern::new(pattern)
            .map(|p| p.matches(path))
            .unwrap_or(false)
    })
}

fn matches_any(path: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        glob::Pattern::new(pattern)
            .map(|p| p.matches(path))
            .unwrap_or(false)
    })
}

// Note: This is a placeholder comment. The ignore patterns are actually passed from JavaScript
// to Rust via the options parameter, so we don't need to duplicate the list here.
// The patterns defined in index.js will be used by the Rust code. 