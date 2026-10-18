#![windows_subsystem = "windows"]
// MSIX startup extensions cannot pass the player's --autostart argument.
fn main() {
    let Some(directory) = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_owned())) else { return; };
    let _ = std::process::Command::new(directory.join("motungi-radio.exe"))
        .arg("--autostart").spawn();
}
