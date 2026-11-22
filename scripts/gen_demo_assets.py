#!/usr/bin/env python3
"""Generate demo assets for Antra Flux: procedural cover art + synthesized
lossless audio tracks (FLAC 16-bit/44.1kHz) so the streaming player works
out of the box in demo mode. All art/music are original, generated here."""
import numpy as np
import subprocess, os, math, random
from PIL import Image, ImageDraw, ImageFilter

OUT_AUDIO = "/home/z/my-project/public/demo-audio"
OUT_COVERS = "/home/z/my-project/public/covers"
os.makedirs(OUT_AUDIO, exist_ok=True)
os.makedirs(OUT_COVERS, exist_ok=True)
SR = 44100
rng = np.random.default_rng(42)

def adsr(n, a=0.05, d=0.1, s=0.7, r=0.2):
    """attack/decay/sustain/release envelope over n samples (times in seconds)"""
    a_n, d_n, r_n = int(a*SR), int(d*SR), int(r*SR)
    s_n = max(0, n - a_n - d_n - r_n)
    env = np.concatenate([
        np.linspace(0, 1, max(a_n,1)),
        np.linspace(1, s, max(d_n,1)),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n,1)),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n-len(env)))

def note_hz(semi, root=220.0):
    return root * (2 ** (semi / 12.0))

def synth_tone(freq, dur, kind="sine", detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    ph = 2*np.pi*f*t + rng.uniform(0, 2*np.pi)
    if kind == "sine":
        w = np.sin(ph)
    elif kind == "tri":
        w = 2/np.pi * np.arcsin(np.sin(ph))
    elif kind == "soft":
        w = np.sin(ph) + 0.35*np.sin(2*ph) + 0.12*np.sin(3*ph)
    elif kind == "sub":
        w = np.sin(ph)
        w += 0.3*np.sin(0.5*ph)
    else:
        w = np.sin(ph)
    return w

def pad_chord(freqs, dur, amp=0.14):
    """soft detuned pad, stereo"""
    n = int(dur*SR)
    L = np.zeros(n); R = np.zeros(n)
    for i, f in enumerate(freqs):
        w1 = synth_tone(f, dur, "soft", detune=0.0015)
        w2 = synth_tone(f, dur, "sine", detune=-0.0012)
        env = adsr(n, a=0.9, d=0.4, s=0.85, r=1.2)
        pan = 0.5 + 0.4*math.sin(i*2.1)
        L += w1*env*amp*(1-pan*0.5) + w2*env*amp*0.4
        R += w2*env*amp*(pan*0.5+0.5) + w1*env*amp*0.4
    return L, R

def arp(freqs, dur, step=0.14, amp=0.10, kind="tri"):
    n = int(dur*SR)
    L = np.zeros(n); R = np.zeros(n)
    t0 = 0
    i = 0
    while t0 < dur:
        d = min(step*2.2, dur-t0)
        s0 = int(t0*SR); ln = int(d*SR)
        if ln <= 0: break
        f = freqs[i % len(freqs)]
        w = synth_tone(f, d, kind)
        env = adsr(ln, a=0.008, d=0.05, s=0.5, r=0.12)
        seg = w*env*amp
        pan = 0.5 + 0.45*math.sin(i*1.7)
        L[s0:s0+ln] += seg*(1-pan*0.6)
        R[s0:s0+ln] += seg*(pan*0.6+0.4)
        t0 += step; i += 1
    return L, R

def sub_bass(freq, dur, amp=0.16, pulse=1.6):
    n = int(dur*SR)
    L = np.zeros(n); R = np.zeros(n)
    t0 = 0
    while t0 < dur:
        d = min(pulse, dur-t0)
        s0 = int(t0*SR); ln = int(d*SR)
        w = synth_tone(freq, d, "sub")
        env = adsr(ln, a=0.02, d=0.3, s=0.6, r=0.3)
        seg = w*env*amp
        L[s0:s0+ln] += seg; R[s0:s0+ln] += seg
        t0 += pulse
    return L, R

def hat(dur, amp=0.045, gap=0.5, deco=0.0):
    """gentle noise percussion on off-beats"""
    n = int(dur*SR)
    L = np.zeros(n); R = np.zeros(n)
    t0 = gap
    k = 0
    while t0 < dur:
        d = 0.045
        s0 = int(t0*SR); ln = int(d*SR)
        if s0+ln > n: break
        noise = rng.standard_normal(ln) * np.exp(-np.linspace(0, 6, ln))
        pan = 0.5 + 0.3*math.sin(k*2.3)
        a = amp * (1 - deco if k % 4 else 1)
        L[s0:s0+ln] += noise*a*(1-pan*0.5)
        R[s0:s0+ln] += noise*a*(pan*0.5+0.5)
        t0 += gap; k += 1
    return L, R

def delay_stereo(L, R, time_s=0.31, fb=0.35, mixes=3):
    """simple stereo ping-pong delay"""
    n = len(L)
    d = int(time_s*SR)
    for i in range(1, mixes+1):
        g = fb**i
        if i % 2 == 1:
            L[d:] += R[:n-d]*g*0.5
        else:
            R[d:] += L[:n-d]*g*0.5
    return L, R

def soft_clip(x):
    return np.tanh(x*1.15)*0.92

def render_track(chords, bass_root, dur, arp_on=True, hat_gap=0.5):
    n = int(dur*SR)
    L = np.zeros(n); R = np.zeros(n)
    t_cursor = 0.0
    ci = 0
    while t_cursor < dur:
        chord = chords[ci % len(chords)]
        cd = min(4.0, dur - t_cursor)
        s0 = int(t_cursor*SR); ln = int(cd*SR)
        if ln <= 0: break
        pL, pR = pad_chord(chord, cd, amp=0.13)
        L[s0:s0+ln] += pL; R[s0:s0+ln] += pR
        if arp_on:
            af = [c*2 for c in chord] + [chord[1]*4]
            aL, aR = arp(af, cd, step=0.16, amp=0.085)
            L[s0:s0+ln] += aL; R[s0:s0+ln] += aR
        bL, bR = sub_bass(note_hz(bass_root-24, 220.0), cd, amp=0.15, pulse=2.0)
        L[s0:s0+ln] += bL; R[s0:s0+ln] += bR
        hL, hR = hat(cd, amp=0.04, gap=hat_gap)
        L[s0:s0+ln] += hL; R[s0:s0+ln] += hR
        t_cursor += cd; ci += 1
    L, R = delay_stereo(L, R)
    fi = int(1.2*SR); fo = int(2.0*SR)
    L[:fi] *= np.linspace(0,1,fi); R[:fi] *= np.linspace(0,1,fi)
    L[-fo:] *= np.linspace(1,0,fo); R[-fo:] *= np.linspace(1,0,fo)
    st = np.stack([soft_clip(L), soft_clip(R)], axis=1)
    peak = np.max(np.abs(st))
    if peak > 0: st = st / peak * 0.88
    return (st * 32767).astype(np.int16)

def save_flac(st, path):
    import wave
    tmp = path.replace(".flac", ".wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(st.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp,
                    "-c:a", "flac", "-compression_level", "5", path], check=True)
    os.remove(tmp)

MINOR7 = lambda root: [note_hz(root), note_hz(root+3), note_hz(root+7), note_hz(root+10)]
ADD9   = lambda root: [note_hz(root), note_hz(root+4), note_hz(root+7), note_hz(root+14)]
SUS4   = lambda root: [note_hz(root), note_hz(root+5), note_hz(root+7), note_hz(root+12)]
MIN9   = lambda root: [note_hz(root), note_hz(root+3), note_hz(root+10), note_hz(root+14)]
MINOR9 = MIN9

TRACKS = [
    ("neon-meridian",  "Neon Meridian",   "Kaelo",         "Neon Meridian",  44, [MINOR7(9), ADD9(14), MINOR7(7), SUS4(12)], 9,  True, 0.30),
    ("chrome-sunrise", "Chrome Sunrise",  "Kaelo",         "Neon Meridian",  40, [ADD9(7), MINOR7(12), SUS4(9), MINOR7(14)], 7,  True, 0.26),
    ("midnight-courier","Midnight Courier","Kaelo",        "Neon Meridian",  46, [MINOR7(5), MINOR9(10), ADD9(3), SUS4(8)],  5,  True, 0.33),
    ("afterglow-drive","Afterglow Drive", "Kaelo",         "Neon Meridian",  38, [ADD9(12), MINOR7(7), SUS4(10), MINOR7(5)], 12, True, 0.28),
    ("deep-signal",    "Deep Signal",     "Vector Fields", "Deep Signal",    52, [MINOR9(4), SUS4(9), MINOR7(11), ADD9(6)],  4,  True, 0.62),
    ("carrier-wave",   "Carrier Wave",    "Vector Fields", "Deep Signal",    48, [MINOR7(2), ADD9(7), MINOR9(9), SUS4(4)],   2,  True, 0.55),
    ("ionosphere",     "Ionosphere",      "Vector Fields", "Deep Signal",    50, [SUS4(11), MINOR7(4), ADD9(9), MINOR9(6)],  11, True, 0.58),
    ("aurora-protocol","Aurora Protocol", "Ilya Voss",     "Aurora Protocol",54, [MINOR9(7), SUS4(12), MINOR7(2), ADD9(9)],  7,  True, 0.70),
    ("polar-veil",     "Polar Veil",      "Ilya Voss",     "Aurora Protocol",46, [ADD9(4), MINOR9(9), SUS4(2), MINOR7(11)],  4,  True, 0.66),
    ("solar-lattice",  "Solar Lattice",   "Ilya Voss",     "Aurora Protocol",42, [MINOR7(0), ADD9(5), SUS4(10), MINOR9(3)],  0,  True, 0.60),
]

for fname, title, artist, album, dur, chords, bass, arp_on, hat_gap in TRACKS:
    path = os.path.join(OUT_AUDIO, fname + ".flac")
    if os.path.exists(path):
        print("skip", fname); continue
    print("rendering", fname, "...", flush=True)
    st = render_track(chords, bass, dur, arp_on=arp_on, hat_gap=hat_gap)
    save_flac(st, path)

# ---- Cover art ---------------------------------------------------------------
def glow(layer, xy, radius, color, alpha=110):
    x, y = xy
    r = radius
    for rr, a in [(radius, alpha), (radius*0.6, int(alpha*0.8)), (radius*0.3, int(alpha*0.9))]:
        s = Image.new("RGBA", layer.size, (0,0,0,0))
        d = ImageDraw.Draw(s)
        d.ellipse([x-rr, y-rr, x+rr, y+rr], fill=color+(a,))
        s = s.filter(ImageFilter.GaussianBlur(r*0.55))
        layer.alpha_composite(s)

def make_cover(kind, hue, fname, seed):
    random.seed(seed)
    W = 1000
    img = Image.new("RGBA", (W, W), (10, 12, 16, 255))
    # background vertical tint of hue
    top = Image.new("RGBA", (W, W), (0,0,0,0))
    td = ImageDraw.Draw(top)
    base_v = 26
    for y in range(W):
        t = y / W
        col = (int(base_v + hue[0]*t*0.9), int(base_v + hue[1]*t*0.9), int(base_v + hue[2]*t*1.1), 255)
        td.line([(0, y), (W, y)], fill=col)
    img.alpha_composite(top)

    layer = Image.new("RGBA", (W, W), (0,0,0,0))
    d2 = ImageDraw.Draw(layer)
    accent = (int(60+hue[0]*2.2), int(200+hue[1]*0.4), int(180+hue[2]*0.4))
    accent2 = (int(180+hue[0]*0.6), int(80+hue[1]*0.8), int(220+hue[2]*0.3))

    if kind == "rings":
        cx, cy = W*0.5, W*0.52
        glow(layer, (cx, cy), 340, accent, 60)
        for r in range(80, 460, 55):
            w = 3 if r % 2 else 7
            d2.arc([cx-r, cy-r, cx+r, cy+r], start=random.randint(0,180), end=random.randint(200,500),
                   fill=accent if r % 2 else accent2, width=w)
        d2.ellipse([cx-16, cy-16, cx+16, cy+16], fill=accent)
    elif kind == "grid":
        hy = W*0.62
        for i in range(0, 24):
            y = hy + (i*i*2.2)
            if y > W: break
            a = max(20, 160 - i*7)
            d2.line([(0, y), (W, y)], fill=accent+(a,), width=2)
        for i in range(-12, 13):
            x0 = W/2 + i*36
            d2.line([(x0, hy), (W/2 + i*160, W)], fill=accent2+(90,), width=2)
        glow(layer, (W/2, hy-40), 260, accent2, 70)
        d2.ellipse([W/2-120, hy-160, W/2+120, hy+80], outline=accent, width=5)
    elif kind == "bars":
        n = 28
        for i in range(n):
            h = random.randint(60, 420)
            x = 90 + i*30
            col = accent if i % 3 else accent2
            d2.rounded_rectangle([x, W-h-120, x+16, W-120], radius=8, fill=col+(150,))
        glow(layer, (W/2, W/2), 300, accent2, 50)
        d2.line([(0, W-120), (W, W-120)], fill=accent+(120,), width=3)
    elif kind == "orbit":
        cx, cy = W*0.5, W*0.5
        for k in range(3):
            r = 150 + k*110
            d2.ellipse([cx-r, cy-r, cx+r, cy+r], outline=accent if k%2 else accent2, width=4)
            px = cx + r*math.cos(k*2.4); py = cy + r*math.sin(k*2.4)
            glow(layer, (px, py), 60, accent2, 160)
        glow(layer, (cx, cy), 180, accent, 90)
        d2.ellipse([cx-34, cy-34, cx+34, cy+34], fill=accent2)
    elif kind == "wave":
        pts = []
        for x in range(0, W, 8):
            y = W*0.5 + 90*math.sin(x*0.012+2) * math.sin(x*0.0037)
            pts.append((x, y))
        d2.line(pts, fill=accent, width=6)
        pts2 = [(x, y*1.7 - W*0.2) for (x, y) in pts]
        d2.line(pts2, fill=accent2+(140,), width=3)
        glow(layer, (W*0.3, W*0.5), 240, accent, 60)
    else:  # "prism"
        for k in range(6):
            off = k*36
            col = accent if k % 2 == 0 else accent2
            d2.polygon([(W/2, 160+off), (W/2-220, 640+off), (W/2+220, 640+off)], outline=col+(170,), width=5)
        glow(layer, (W/2, W*0.42), 230, accent2, 80)

    img.alpha_composite(layer)
    noise = (rng.standard_normal((W, W, 1)) * 6).astype(np.int16)
    arr = np.array(img.convert("RGB")).astype(np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr).convert("RGB").save(os.path.join(OUT_COVERS, fname + ".jpg"), quality=88)

COVERS = [
    ("neon-meridian",  "rings", (120, 60, 40), 7),
    ("chrome-sunrise", "grid", (150, 90, 30), 12),
    ("midnight-courier","bars", (100, 50, 90), 21),
    ("afterglow-drive","wave", (170, 60, 60), 33),
    ("deep-signal",    "orbit", (60, 140, 60), 5),
    ("carrier-wave",   "wave", (80, 120, 100), 18),
    ("ionosphere",     "prism", (50, 150, 90), 27),
    ("aurora-protocol","orbit", (90, 130, 140), 41),
    ("polar-veil",     "prism", (60, 110, 160), 55),
    ("solar-lattice",  "rings", (160, 110, 30), 63),
]
for fname, kind, hue, seed in COVERS:
    make_cover(kind, hue, fname, seed)

print("ASSETS DONE")
