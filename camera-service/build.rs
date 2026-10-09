use std::path::PathBuf;

fn main() {
    let sdk = std::env::var("IRAYPLE_SDK_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\Program Files\HuarayTech\MV Viewer\Development"));
    let lib = sdk.join("Lib").join("x64");
    if lib.exists() {
        println!("cargo:rustc-link-search=native={}", lib.display());
    }
    println!("cargo:rerun-if-env-changed=IRAYPLE_SDK_DIR");
}
