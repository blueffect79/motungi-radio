//! White, folded-corner radio drawn at menu-bar size without extra image dependencies.
const WIDTH: usize = 30;
const HEIGHT: usize = 22;

fn segment(x: f32, y: f32, a: (f32, f32), b: (f32, f32)) -> f32 {
    let dx = b.0 - a.0;
    let dy = b.1 - a.1;
    let t = ((x - a.0) * dx + (y - a.1) * dy) / (dx * dx + dy * dy);
    let t = t.clamp(0.0, 1.0);
    ((x - a.0 - t * dx).powi(2) + (y - a.1 - t * dy).powi(2)).sqrt()
}

fn distance(x: f32, y: f32, playing: bool) -> f32 {
    let lines = [
        // The folded top-right corner identifies the radio.
        ((3.0, 6.0), (15.5, 6.0)),
        ((15.5, 6.0), (20.0, 10.5)),
        ((20.0, 10.5), (20.0, 18.0)),
        ((20.0, 18.0), (3.0, 18.0)),
        ((3.0, 18.0), (3.0, 6.0)),
        ((15.5, 6.0), (15.5, 10.5)),
        ((15.5, 10.5), (20.0, 10.5)),
        ((6.0, 3.5), (16.0, 1.5)),
        ((6.0, 3.5), (6.0, 6.0)),
        ((13.5, 14.0), (16.5, 14.0)),
    ];
    let mut d = lines.iter().fold(f32::INFINITY, |d, &(a, b)| {
        d.min(segment(x, y, a, b) - 0.65)
    });
    d = d.min((((x - 8.0).powi(2) + (y - 12.0).powi(2)).sqrt() - 2.5).abs() - 0.65);
    if playing {
        let triangle = [
            ((24.0, 12.5), (28.0, 15.5)),
            ((28.0, 15.5), (24.0, 18.5)),
            ((24.0, 18.5), (24.0, 12.5)),
        ];
        let edge = triangle
            .iter()
            .fold(f32::INFINITY, |d, &(a, b)| d.min(segment(x, y, a, b)));
        let inside = x >= 24.0 && x <= 28.0 && (y - 15.5).abs() <= (28.0 - x) * 0.75;
        d = d.min(if inside { -edge } else { edge });
    } else {
        d = d.min(segment(x, y, (24.0, 13.0), (24.0, 18.0)) - 0.8);
        d = d.min(segment(x, y, (27.5, 13.0), (27.5, 18.0)) - 0.8);
    }
    d
}

pub(super) fn pixels(playing: bool) -> Vec<u8> {
    let mut pixels = vec![0; WIDTH * HEIGHT * 4];
    for y in 0..HEIGHT {
        for x in 0..WIDTH {
            let (mut white, mut alpha) = (0.0_f32, 0.0_f32);
            // Supersample for smooth diagonals; retain the existing 30×22 logical size.
            for sy in 0..4 {
                for sx in 0..4 {
                    let d = distance(
                        x as f32 + (sx as f32 + 0.5) / 4.0,
                        y as f32 + (sy as f32 + 0.5) / 4.0,
                        playing,
                    );
                    if d <= 0.0 {
                        white += 1.0;
                        alpha += 1.0;
                    } else if d <= 0.65 {
                        alpha += 0.6;
                    }
                }
            }
            if alpha > 0.0 {
                let i = (y * WIDTH + x) * 4;
                let color = (255.0 * white / alpha).round() as u8;
                pixels[i..i + 3].fill(color);
                pixels[i + 3] = (255.0 * alpha / 16.0).round() as u8;
            }
        }
    }
    pixels
}
