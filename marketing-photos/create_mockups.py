"""
Script de criação de mockups profissionais para marketing
Composita screenshots reais do sistema Tubarão dentro de frames de dispositivos
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
import math

SCREENSHOTS = "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/marketing-photos/screenshots"
OUTPUT = "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/marketing-photos/mockups-reais"
os.makedirs(OUTPUT, exist_ok=True)

# ─────────────────────────────────────────────
# HELPER: gradient background
# ─────────────────────────────────────────────

def make_gradient(width, height, color_top=(5, 10, 20), color_bottom=(15, 30, 60)):
    img = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / height
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    return img

def add_noise(img, intensity=8):
    """Adiciona grain sutil para look profissional"""
    import random
    data = list(img.getdata())
    new_data = []
    for pixel in data:
        noise = random.randint(-intensity, intensity)
        if len(pixel) == 4:
            new_data.append((
                max(0, min(255, pixel[0] + noise)),
                max(0, min(255, pixel[1] + noise)),
                max(0, min(255, pixel[2] + noise)),
                pixel[3]
            ))
        else:
            new_data.append((
                max(0, min(255, pixel[0] + noise)),
                max(0, min(255, pixel[1] + noise)),
                max(0, min(255, pixel[2] + noise)),
            ))
    img.putdata(new_data)
    return img

def draw_glow(draw, x, y, r, color, steps=20):
    """Desenha um halo brilhante"""
    for i in range(steps, 0, -1):
        alpha = int(60 * (i / steps) ** 2)
        radius = r + (steps - i) * 3
        draw.ellipse(
            [x - radius, y - radius, x + radius, y + radius],
            fill=(*color, alpha)
        )

def rounded_rect_mask(size, radius):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius=radius, fill=255)
    return mask

# ─────────────────────────────────────────────
# FRAME BUILDERS
# ─────────────────────────────────────────────

def build_iphone_frame(screenshot_path, output_path, canvas_w=1080, canvas_h=1920):
    """iPhone 15 Pro frame com screenshot real dentro"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))

    # Background gradiente escuro com toque azul/azul marinho (marca Tubarão)
    bg = make_gradient(canvas_w, canvas_h, (3, 8, 18), (8, 20, 50))
    canvas.paste(bg, (0, 0))

    # Efeito de luz ambiente (glow azul embaixo)
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(30, 0, -1):
        alpha = int(40 * (i / 30) ** 2)
        od.ellipse(
            [canvas_w//2 - 300 - i*8, canvas_h - 400 - i*5,
             canvas_w//2 + 300 + i*8, canvas_h - 400 + i*5],
            fill=(0, 120, 255, alpha)
        )
    canvas = Image.alpha_composite(canvas, overlay)

    # Dimensões do iPhone
    phone_w = int(canvas_w * 0.72)
    phone_h = int(phone_w * 2.165)  # ratio iPhone 15 Pro
    phone_x = (canvas_w - phone_w) // 2
    phone_y = (canvas_h - phone_h) // 2

    # Corpo do iPhone (frame de titanio/escuro)
    draw = ImageDraw.Draw(canvas)
    corner_r = int(phone_w * 0.12)

    # Sombra do phone
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(25, 0, -1):
        alpha = int(80 * (i / 25) ** 1.5)
        sd.rounded_rectangle(
            [phone_x - i*2, phone_y - i + 30,
             phone_x + phone_w + i*2, phone_y + phone_h + i + 30],
            radius=corner_r + i, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, shadow)
    draw = ImageDraw.Draw(canvas)

    # Frame externo - titanio escuro com brilho
    frame_color = (40, 42, 48)
    draw.rounded_rectangle(
        [phone_x, phone_y, phone_x + phone_w, phone_y + phone_h],
        radius=corner_r, fill=frame_color
    )

    # Borda brilhante (titanio)
    for thickness in range(3, 0, -1):
        alpha_val = [180, 120, 60][3-thickness]
        bord_color = (180, 185, 195)
        draw.rounded_rectangle(
            [phone_x + thickness - 1, phone_y + thickness - 1,
             phone_x + phone_w - thickness + 1, phone_y + phone_h - thickness + 1],
            radius=corner_r - thickness + 1,
            outline=(*bord_color, alpha_val), width=1
        )

    # Área da tela
    bezel = int(phone_w * 0.028)
    screen_x = phone_x + bezel
    screen_y = phone_y + bezel
    screen_w = phone_w - bezel * 2
    screen_h = phone_h - bezel * 2
    screen_r = int(corner_r * 0.82)

    # Colocar o screenshot real
    screenshot = Image.open(screenshot_path).convert("RGBA")
    screenshot = screenshot.resize((screen_w, screen_h), Image.LANCZOS)

    # Mask com cantos arredondados para a tela
    screen_mask = rounded_rect_mask((screen_w, screen_h), screen_r)

    screen_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    screen_layer.paste(screenshot, (screen_x, screen_y), screen_mask)
    canvas = Image.alpha_composite(canvas, screen_layer)
    draw = ImageDraw.Draw(canvas)

    # Dynamic Island (notch pill)
    di_w = int(phone_w * 0.28)
    di_h = int(phone_w * 0.065)
    di_x = screen_x + (screen_w - di_w) // 2
    di_y = screen_y + int(phone_w * 0.018)
    draw.rounded_rectangle(
        [di_x, di_y, di_x + di_w, di_y + di_h],
        radius=di_h // 2, fill=(5, 5, 8)
    )

    # Botão lateral direito (power)
    btn_x = phone_x + phone_w - 2
    btn_y = phone_y + int(phone_h * 0.35)
    btn_h = int(phone_h * 0.10)
    draw.rounded_rectangle(
        [btn_x, btn_y, btn_x + 5, btn_y + btn_h],
        radius=2, fill=(55, 57, 63)
    )

    # Botões volume esquerdo
    v_x = phone_x - 3
    v_y1 = phone_y + int(phone_h * 0.22)
    v_h = int(phone_h * 0.06)
    draw.rounded_rectangle([v_x - 5, v_y1, v_x, v_y1 + v_h], radius=2, fill=(55, 57, 63))
    v_y2 = v_y1 + v_h + int(phone_h * 0.025)
    draw.rounded_rectangle([v_x - 5, v_y2, v_x, v_y2 + v_h], radius=2, fill=(55, 57, 63))

    # Reflexo sutil na tela (diagonal)
    refl = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(refl)
    rd.polygon([
        (screen_x, screen_y),
        (screen_x + screen_w * 0.45, screen_y),
        (screen_x, screen_y + screen_h * 0.35),
    ], fill=(255, 255, 255, 8))
    canvas = Image.alpha_composite(canvas, refl)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ iPhone mockup: {output_path}")


def build_macbook_frame(screenshot_path, output_path, canvas_w=1920, canvas_h=1080):
    """MacBook Pro frame com screenshot real dentro"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))

    # Background: azul escuro / marinho profissional
    bg = make_gradient(canvas_w, canvas_h, (4, 8, 20), (12, 22, 55))
    canvas.paste(bg, (0, 0))

    # Glow de luz azul
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(40, 0, -1):
        alpha = int(35 * (i / 40) ** 2)
        od.ellipse(
            [canvas_w//2 - 500 - i*10, canvas_h//2 - 300 - i*6,
             canvas_w//2 + 500 + i*10, canvas_h//2 + 300 + i*6],
            fill=(0, 100, 255, alpha)
        )
    canvas = Image.alpha_composite(canvas, overlay)

    # MacBook dimensions
    lid_w = int(canvas_w * 0.78)
    lid_h = int(lid_w * 0.62)
    lid_x = (canvas_w - lid_w) // 2
    lid_y = int(canvas_h * 0.04)

    # Sombra
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(30, 0, -1):
        alpha = int(90 * (i / 30) ** 1.5)
        sd.rounded_rectangle(
            [lid_x - i*2, lid_y + lid_h - 10 + i,
             lid_x + lid_w + i*2, lid_y + lid_h + 10 + i*3],
            radius=4, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, shadow)
    draw = ImageDraw.Draw(canvas)

    # Tampa (lid) - alumínio espacial
    lid_color = (35, 36, 38)
    draw.rounded_rectangle(
        [lid_x, lid_y, lid_x + lid_w, lid_y + lid_h],
        radius=18, fill=lid_color
    )

    # Borda brilhante fina
    draw.rounded_rectangle(
        [lid_x, lid_y, lid_x + lid_w, lid_y + lid_h],
        radius=18, outline=(80, 82, 88), width=2
    )

    # Tela (bezel interno)
    bezel_h = int(lid_h * 0.042)
    bezel_sides = int(lid_w * 0.022)
    bezel_bottom = int(lid_h * 0.05)

    screen_x = lid_x + bezel_sides
    screen_y = lid_y + bezel_h
    screen_w = lid_w - bezel_sides * 2
    screen_h = lid_h - bezel_h - bezel_bottom
    screen_r = 8

    # Screenshot real
    screenshot = Image.open(screenshot_path).convert("RGBA")
    screenshot = screenshot.resize((screen_w, screen_h), Image.LANCZOS)

    screen_mask = rounded_rect_mask((screen_w, screen_h), screen_r)
    screen_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    screen_layer.paste(screenshot, (screen_x, screen_y), screen_mask)
    canvas = Image.alpha_composite(canvas, screen_layer)
    draw = ImageDraw.Draw(canvas)

    # Notch (câmera)
    notch_w = int(lid_w * 0.06)
    notch_h = int(bezel_h * 0.8)
    notch_x = lid_x + (lid_w - notch_w) // 2
    notch_y = lid_y
    draw.rounded_rectangle(
        [notch_x, notch_y, notch_x + notch_w, notch_y + notch_h],
        radius=5, fill=lid_color
    )

    # Camera dot
    cam_x = lid_x + lid_w // 2
    cam_y = lid_y + int(bezel_h * 0.45)
    draw.ellipse([cam_x - 4, cam_y - 4, cam_x + 4, cam_y + 4], fill=(28, 28, 30))
    draw.ellipse([cam_x - 2, cam_y - 2, cam_x + 2, cam_y + 2], fill=(45, 48, 55))

    # Base do MacBook (parte inferior)
    base_y = lid_y + lid_h
    base_h = int(lid_h * 0.035)
    base_taper = int(lid_w * 0.02)

    # Trapézio da base
    base_pts = [
        (lid_x + base_taper, base_y),
        (lid_x + lid_w - base_taper, base_y),
        (lid_x + lid_w - base_taper + int(lid_w * 0.03), base_y + base_h),
        (lid_x + base_taper - int(lid_w * 0.03), base_y + base_h),
    ]
    draw.polygon(base_pts, fill=(40, 41, 43))
    draw.line([base_pts[0], base_pts[1]], fill=(70, 72, 78), width=2)

    # Borracha pés
    base_bottom = base_y + base_h
    for fx in [lid_x + int(lid_w * 0.12), lid_x + lid_w - int(lid_w * 0.12)]:
        draw.rounded_rectangle(
            [fx - 20, base_bottom - 4, fx + 20, base_bottom + 6],
            radius=3, fill=(22, 22, 24)
        )

    # Reflexo sutil na tela
    refl = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(refl)
    rd.polygon([
        (screen_x, screen_y),
        (screen_x + screen_w * 0.4, screen_y),
        (screen_x, screen_y + screen_h * 0.3),
    ], fill=(255, 255, 255, 6))
    canvas = Image.alpha_composite(canvas, refl)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ MacBook mockup: {output_path}")


def build_dual_iphone(screenshot1_path, screenshot2_path, output_path, canvas_w=1080, canvas_h=1080):
    """Dois iPhones lado a lado (formato feed quadrado)"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))
    bg = make_gradient(canvas_w, canvas_h, (3, 8, 18), (10, 25, 60))
    canvas.paste(bg, (0, 0))

    # Luzes ambiente
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(25, 0, -1):
        alpha = int(30 * (i / 25) ** 2)
        od.ellipse([150 - i*5, 400 - i*3, 450 + i*5, 700 + i*3], fill=(0, 100, 255, alpha))
        od.ellipse([600 - i*5, 400 - i*3, 900 + i*5, 700 + i*3], fill=(0, 80, 200, alpha))
    canvas = Image.alpha_composite(canvas, overlay)

    def draw_phone_on_canvas(ss_path, px, py, pw, ph, canvas, angle=0):
        """Desenha um iPhone em posição/ângulo específico"""
        phone_img = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        draw = ImageDraw.Draw(phone_img)

        cr = int(pw * 0.115)
        frame_col = (38, 40, 46)

        # Sombra interna
        draw.rounded_rectangle([0, 0, pw-1, ph-1], radius=cr, fill=frame_col)
        draw.rounded_rectangle([0, 0, pw-1, ph-1], radius=cr, outline=(75, 78, 88), width=2)

        # Tela
        bz = int(pw * 0.03)
        sw = pw - bz*2
        sh = ph - bz*2
        sr = int(cr * 0.8)

        ss = Image.open(ss_path).convert("RGBA").resize((sw, sh), Image.LANCZOS)
        mask = rounded_rect_mask((sw, sh), sr)
        phone_img.paste(ss, (bz, bz), mask)

        # Dynamic Island
        di_w = int(pw * 0.27)
        di_h = int(pw * 0.063)
        di_x = (pw - di_w) // 2
        di_y = bz + int(pw * 0.018)
        draw = ImageDraw.Draw(phone_img)
        draw.rounded_rectangle([di_x, di_y, di_x + di_w, di_y + di_h], radius=di_h//2, fill=(5, 5, 8))

        # Rotate se necessário
        if angle != 0:
            phone_img = phone_img.rotate(angle, expand=True, resample=Image.BICUBIC)

        # Paste no canvas
        paste_x = px - phone_img.width // 2
        paste_y = py - phone_img.height // 2
        canvas = Image.alpha_composite(canvas,
            Image.new("RGBA", (canvas_w, canvas_h), (0,0,0,0)).paste(phone_img, (paste_x, paste_y)) or canvas)

        # Forma mais robusta:
        temp = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        temp.paste(phone_img, (paste_x, paste_y), phone_img)
        return Image.alpha_composite(canvas, temp)

    pw = int(canvas_w * 0.38)
    ph = int(pw * 2.165)

    # iPhone esquerdo (leve rotação para efeito dinamismo)
    canvas = draw_phone_on_canvas(screenshot1_path, int(canvas_w * 0.3), canvas_h // 2, pw, ph, canvas, angle=-8)
    # iPhone direito
    canvas = draw_phone_on_canvas(screenshot2_path, int(canvas_w * 0.7), canvas_h // 2, pw, ph, canvas, angle=8)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ Dual iPhone mockup: {output_path}")


def build_ipad_frame(screenshot_path, output_path, canvas_w=1400, canvas_h=1050):
    """iPad Pro frame"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))
    bg = make_gradient(canvas_w, canvas_h, (4, 9, 22), (10, 22, 55))
    canvas.paste(bg, (0, 0))

    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(35, 0, -1):
        alpha = int(30 * (i / 35) ** 2)
        od.ellipse([300 - i*8, 200 - i*5, 1100 + i*8, 850 + i*5], fill=(0, 90, 220, alpha))
    canvas = Image.alpha_composite(canvas, overlay)

    ipad_w = int(canvas_w * 0.72)
    ipad_h = int(ipad_w * 0.726)
    ipad_x = (canvas_w - ipad_w) // 2
    ipad_y = (canvas_h - ipad_h) // 2
    cr = int(ipad_w * 0.03)

    # Sombra
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(25, 0, -1):
        alpha = int(80 * (i / 25) ** 1.5)
        sd.rounded_rectangle(
            [ipad_x - i*2, ipad_y - i + 20, ipad_x + ipad_w + i*2, ipad_y + ipad_h + i + 20],
            radius=cr + i, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, shadow)
    draw = ImageDraw.Draw(canvas)

    # Corpo
    draw.rounded_rectangle([ipad_x, ipad_y, ipad_x + ipad_w, ipad_y + ipad_h], radius=cr, fill=(36, 37, 40))
    draw.rounded_rectangle([ipad_x, ipad_y, ipad_x + ipad_w, ipad_y + ipad_h], radius=cr, outline=(72, 74, 82), width=2)

    # Tela
    bz = int(ipad_w * 0.032)
    sx = ipad_x + bz
    sy = ipad_y + bz
    sw = ipad_w - bz * 2
    sh = ipad_h - bz * 2
    sr = int(cr * 0.6)

    ss = Image.open(screenshot_path).convert("RGBA").resize((sw, sh), Image.LANCZOS)
    mask = rounded_rect_mask((sw, sh), sr)
    sl = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sl.paste(ss, (sx, sy), mask)
    canvas = Image.alpha_composite(canvas, sl)
    draw = ImageDraw.Draw(canvas)

    # Camera dot (no bezel superior direito)
    cam_x = ipad_x + ipad_w - bz // 2
    cam_y = ipad_y + ipad_h // 2
    draw.ellipse([cam_x - 5, cam_y - 5, cam_x + 5, cam_y + 5], fill=(26, 26, 28))
    draw.ellipse([cam_x - 3, cam_y - 3, cam_x + 3, cam_y + 3], fill=(40, 42, 48))

    # Reflexo
    refl = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(refl)
    rd.polygon([(sx, sy), (sx + sw*0.35, sy), (sx, sy + sh*0.28)], fill=(255, 255, 255, 7))
    canvas = Image.alpha_composite(canvas, refl)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ iPad mockup: {output_path}")


def build_macbook_iphone(desk_path, mobile_path, output_path, canvas_w=1920, canvas_h=1080):
    """MacBook + iPhone juntos na mesma imagem (hero shot)"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))
    bg = make_gradient(canvas_w, canvas_h, (3, 7, 18), (8, 18, 50))
    canvas.paste(bg, (0, 0))

    # Luzes atmosféricas
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(45, 0, -1):
        alpha = int(25 * (i / 45) ** 2)
        od.ellipse([400 - i*12, 200 - i*8, 1200 + i*12, 800 + i*8], fill=(0, 80, 200, alpha))
        od.ellipse([1200 - i*5, 300 - i*4, 1600 + i*5, 700 + i*4], fill=(0, 60, 150, alpha))
    canvas = Image.alpha_composite(canvas, overlay)

    # ── MacBook ──
    mac_w = int(canvas_w * 0.62)
    mac_h = int(mac_w * 0.62)
    mac_x = int(canvas_w * 0.04)
    mac_y = (canvas_h - mac_h) // 2 - int(canvas_h * 0.03)

    # Sombra MacBook
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(20, 0, -1):
        alpha = int(70 * (i / 20) ** 1.5)
        sd.rounded_rectangle(
            [mac_x - i, mac_y - i + 20, mac_x + mac_w + i, mac_y + mac_h + i + 20],
            radius=15 + i, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, shadow)
    draw = ImageDraw.Draw(canvas)

    # Tampa MacBook
    draw.rounded_rectangle([mac_x, mac_y, mac_x + mac_w, mac_y + mac_h], radius=16, fill=(35, 36, 38))
    draw.rounded_rectangle([mac_x, mac_y, mac_x + mac_w, mac_y + mac_h], radius=16, outline=(78, 80, 86), width=2)

    # Tela MacBook
    bz_h = int(mac_h * 0.042)
    bz_s = int(mac_w * 0.022)
    bz_b = int(mac_h * 0.048)
    sx = mac_x + bz_s
    sy = mac_y + bz_h
    sw = mac_w - bz_s * 2
    sh = mac_h - bz_h - bz_b

    ss_mac = Image.open(desk_path).convert("RGBA").resize((sw, sh), Image.LANCZOS)
    mask = rounded_rect_mask((sw, sh), 8)
    sl = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sl.paste(ss_mac, (sx, sy), mask)
    canvas = Image.alpha_composite(canvas, sl)
    draw = ImageDraw.Draw(canvas)

    # Notch
    nw = int(mac_w * 0.057)
    nh = int(bz_h * 0.78)
    nx = mac_x + (mac_w - nw) // 2
    draw.rounded_rectangle([nx, mac_y, nx + nw, mac_y + nh], radius=5, fill=(35, 36, 38))

    # Base MacBook
    base_y = mac_y + mac_h
    base_h = int(mac_h * 0.032)
    taper = int(mac_w * 0.018)
    base_pts = [
        (mac_x + taper, base_y),
        (mac_x + mac_w - taper, base_y),
        (mac_x + mac_w - taper + int(mac_w * 0.028), base_y + base_h),
        (mac_x + taper - int(mac_w * 0.028), base_y + base_h),
    ]
    draw.polygon(base_pts, fill=(40, 41, 43))

    # ── iPhone ──
    ph_w = int(canvas_w * 0.185)
    ph_h = int(ph_w * 2.165)
    ph_x = canvas_w - ph_w - int(canvas_w * 0.05)
    ph_y = (canvas_h - ph_h) // 2

    phone_img = Image.new("RGBA", (ph_w, ph_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(phone_img)

    cr = int(ph_w * 0.115)
    pd.rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], radius=cr, fill=(38, 40, 46))
    pd.rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], radius=cr, outline=(75, 78, 88), width=2)

    # Tela iPhone
    bz = int(ph_w * 0.03)
    isw = ph_w - bz * 2
    ish = ph_h - bz * 2
    isr = int(cr * 0.8)

    ss_mob = Image.open(mobile_path).convert("RGBA").resize((isw, ish), Image.LANCZOS)
    ph_mask = rounded_rect_mask((isw, ish), isr)
    phone_img.paste(ss_mob, (bz, bz), ph_mask)
    pd = ImageDraw.Draw(phone_img)

    # Dynamic Island
    di_w = int(ph_w * 0.27)
    di_h = int(ph_w * 0.063)
    di_x = (ph_w - di_w) // 2
    di_y = bz + int(ph_w * 0.018)
    pd.rounded_rectangle([di_x, di_y, di_x + di_w, di_y + di_h], radius=di_h//2, fill=(5, 5, 8))

    # Botões
    pd.rounded_rectangle([ph_w - 2, int(ph_h*0.35), ph_w + 5, int(ph_h*0.45)], radius=2, fill=(55, 57, 63))
    pd.rounded_rectangle([-3, int(ph_h*0.22), 0, int(ph_h*0.28)], radius=2, fill=(55, 57, 63))
    pd.rounded_rectangle([-3, int(ph_h*0.30), 0, int(ph_h*0.36)], radius=2, fill=(55, 57, 63))

    # Sombra iPhone
    ph_shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    psd = ImageDraw.Draw(ph_shadow)
    for i in range(20, 0, -1):
        alpha = int(60 * (i / 20) ** 1.5)
        psd.rounded_rectangle(
            [ph_x - i, ph_y - i + 15, ph_x + ph_w + i, ph_y + ph_h + i + 15],
            radius=cr + i, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, ph_shadow)

    temp = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    temp.paste(phone_img, (ph_x, ph_y), phone_img)
    canvas = Image.alpha_composite(canvas, temp)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ MacBook + iPhone mockup: {output_path}")


def build_stories_format(screenshot_path, output_path, canvas_w=1080, canvas_h=1920):
    """Formato Stories/Reels 9:16 com iPhone"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h))
    bg = make_gradient(canvas_w, canvas_h, (3, 8, 20), (10, 22, 58))
    canvas.paste(bg, (0, 0))

    # Partículas/estrelas de fundo
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    import random
    random.seed(42)
    for _ in range(80):
        x = random.randint(0, canvas_w)
        y = random.randint(0, canvas_h)
        size = random.randint(1, 3)
        alpha = random.randint(30, 100)
        od.ellipse([x-size, y-size, x+size, y+size], fill=(200, 220, 255, alpha))

    # Luzes circulares
    for cx, cy, col in [(200, 400, (0, 80, 200)), (880, 1500, (0, 60, 180))]:
        for i in range(30, 0, -1):
            alpha = int(20 * (i / 30) ** 2)
            od.ellipse([cx - i*15, cy - i*15, cx + i*15, cy + i*15], fill=(*col, alpha))
    canvas = Image.alpha_composite(canvas, overlay)

    # iPhone centrado, tamanho grande
    ph_w = int(canvas_w * 0.72)
    ph_h = int(ph_w * 2.165)
    ph_x = (canvas_w - ph_w) // 2
    ph_y = int(canvas_h * 0.1)

    phone_img = Image.new("RGBA", (ph_w, ph_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(phone_img)
    cr = int(ph_w * 0.115)

    # Sombra
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(25, 0, -1):
        alpha = int(80 * (i / 25) ** 1.5)
        sd.rounded_rectangle(
            [ph_x - i*2, ph_y - i + 30, ph_x + ph_w + i*2, ph_y + ph_h + i + 30],
            radius=cr + i, fill=(0, 0, 0, alpha)
        )
    canvas = Image.alpha_composite(canvas, shadow)

    pd.rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], radius=cr, fill=(38, 40, 46))
    pd.rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], radius=cr, outline=(75, 78, 88), width=2)

    bz = int(ph_w * 0.028)
    isw = ph_w - bz * 2
    ish = ph_h - bz * 2
    isr = int(cr * 0.8)

    ss = Image.open(screenshot_path).convert("RGBA").resize((isw, ish), Image.LANCZOS)
    ph_mask = rounded_rect_mask((isw, ish), isr)
    phone_img.paste(ss, (bz, bz), ph_mask)
    pd = ImageDraw.Draw(phone_img)

    di_w = int(ph_w * 0.27)
    di_h = int(ph_w * 0.063)
    di_x = (ph_w - di_w) // 2
    di_y = bz + int(ph_w * 0.018)
    pd.rounded_rectangle([di_x, di_y, di_x + di_w, di_y + di_h], radius=di_h//2, fill=(5, 5, 8))

    pd.rounded_rectangle([ph_w - 2, int(ph_h*0.35), ph_w + 5, int(ph_h*0.45)], radius=2, fill=(55, 57, 63))
    pd.rounded_rectangle([-3, int(ph_h*0.22), 0, int(ph_h*0.28)], radius=2, fill=(55, 57, 63))
    pd.rounded_rectangle([-3, int(ph_h*0.30), 0, int(ph_h*0.36)], radius=2, fill=(55, 57, 63))

    temp = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    temp.paste(phone_img, (ph_x, ph_y), phone_img)
    canvas = Image.alpha_composite(canvas, temp)

    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✅ Stories mockup: {output_path}")


# ─────────────────────────────────────────────
# GERAR TODOS OS MOCKUPS
# ─────────────────────────────────────────────

print("\n🦈 Tubarão Empréstimos — Gerando mockups reais profissionais...\n")

# 1. iPhone com dashboard do cliente
build_iphone_frame(
    f"{SCREENSHOTS}/mobile-client-dashboard.png",
    f"{OUTPUT}/01-iphone-dashboard-cliente.jpg",
    canvas_w=1080, canvas_h=1920
)

# 2. iPhone com tela de solicitação de empréstimo
build_iphone_frame(
    f"{SCREENSHOTS}/mobile-client-loan.png",
    f"{OUTPUT}/02-iphone-solicitacao-emprestimo.jpg",
    canvas_w=1080, canvas_h=1920
)

# 3. MacBook com dashboard admin
build_macbook_frame(
    f"{SCREENSHOTS}/desktop-admin-dashboard.png",
    f"{OUTPUT}/03-macbook-admin-dashboard.jpg",
    canvas_w=1920, canvas_h=1080
)

# 4. MacBook com solicitações admin
build_macbook_frame(
    f"{SCREENSHOTS}/desktop-admin-requests.png",
    f"{OUTPUT}/04-macbook-admin-solicitacoes.jpg",
    canvas_w=1920, canvas_h=1080
)

# 5. iPad com tela admin de clientes
build_ipad_frame(
    f"{SCREENSHOTS}/desktop-admin-clients.png",
    f"{OUTPUT}/05-ipad-admin-clientes.jpg",
    canvas_w=1400, canvas_h=1050
)

# 6. Hero shot: MacBook + iPhone (banner principal)
build_macbook_iphone(
    f"{SCREENSHOTS}/desktop-admin-dashboard.png",
    f"{SCREENSHOTS}/mobile-client-dashboard.png",
    f"{OUTPUT}/06-hero-macbook-iphone.jpg",
    canvas_w=1920, canvas_h=1080
)

# 7. Dois iPhones (feed quadrado)
build_dual_iphone(
    f"{SCREENSHOTS}/mobile-client-dashboard.png",
    f"{SCREENSHOTS}/mobile-client-loan.png",
    f"{OUTPUT}/07-feed-dois-iphones.jpg",
    canvas_w=1080, canvas_h=1080
)

# 8. Stories/Reels com iPhone
build_stories_format(
    f"{SCREENSHOTS}/mobile-client-dashboard.png",
    f"{OUTPUT}/08-stories-iphone-cliente.jpg",
    canvas_w=1080, canvas_h=1920
)

# 9. MacBook com página home
build_macbook_frame(
    f"{SCREENSHOTS}/desktop-home.png",
    f"{OUTPUT}/09-macbook-home.jpg",
    canvas_w=1920, canvas_h=1080
)

# 10. iPhone com home mobile
build_iphone_frame(
    f"{SCREENSHOTS}/mobile-home.png",
    f"{OUTPUT}/10-iphone-home.jpg",
    canvas_w=1080, canvas_h=1920
)

# 11. Stories com admin dashboard
build_stories_format(
    f"{SCREENSHOTS}/mobile-admin-dashboard.png",
    f"{OUTPUT}/11-stories-admin-dashboard.jpg",
    canvas_w=1080, canvas_h=1920
)

# 12. Hero shot com contracts
build_macbook_iphone(
    f"{SCREENSHOTS}/desktop-admin-contracts.png",
    f"{SCREENSHOTS}/mobile-admin-requests.png",
    f"{OUTPUT}/12-hero-contratos.jpg",
    canvas_w=1920, canvas_h=1080
)

print("\n✅ Todos os mockups gerados em:")
print(f"   {OUTPUT}")
import os
files = os.listdir(OUTPUT)
for f in sorted(files):
    size = os.path.getsize(os.path.join(OUTPUT, f))
    print(f"   📸 {f} ({size//1024}KB)")
