"""
Gera mockups profissionais com as novas capturas v3 (reais, logadas)
"""
from PIL import Image, ImageDraw
import os

SCREENSHOTS = "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/marketing-photos/screenshots"
OUTPUT = "J:/AREA DE TRABALHO/Projetos/TUBARÃO EMPRÉSTIMOS LTDA/marketing-photos/mockups-reais"
os.makedirs(OUTPUT, exist_ok=True)

def make_gradient(width, height, top=(3,8,20), bot=(10,22,55)):
    img = Image.new("RGBA", (width, height))
    d = ImageDraw.Draw(img)
    for y in range(height):
        t = y/height
        r = int(top[0]+(bot[0]-top[0])*t)
        g = int(top[1]+(bot[1]-top[1])*t)
        b = int(top[2]+(bot[2]-top[2])*t)
        d.line([(0,y),(width,y)], fill=(r,g,b,255))
    return img

def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,size[0]-1,size[1]-1], radius=r, fill=255)
    return m

def shadow_layer(canvas_size, x, y, w, h, r, offset=20, blur_steps=20):
    s = Image.new("RGBA", canvas_size, (0,0,0,0))
    d = ImageDraw.Draw(s)
    for i in range(blur_steps, 0, -1):
        a = int(70*(i/blur_steps)**1.4)
        expand = (blur_steps-i)*2
        d.rounded_rectangle(
            [x-expand, y-expand+offset, x+w+expand, y+h+expand+offset],
            radius=r+expand, fill=(0,0,0,a)
        )
    return s

def place_screen(canvas, ss_path, sx, sy, sw, sh, sr):
    """Coloca screenshot redimensionado na posição com mask arredondada"""
    try:
        ss = Image.open(ss_path).convert("RGBA")
        ss = ss.resize((sw, sh), Image.LANCZOS)
        mask = rounded_mask((sw, sh), sr)
        layer = Image.new("RGBA", canvas.size, (0,0,0,0))
        layer.paste(ss, (sx, sy), mask)
        return Image.alpha_composite(canvas, layer)
    except Exception as e:
        print(f"  ERRO ao carregar {ss_path}: {e}")
        return canvas

def glow(canvas, cx, cy, rx, ry, color, steps=25):
    o = Image.new("RGBA", canvas.size, (0,0,0,0))
    d = ImageDraw.Draw(o)
    for i in range(steps,0,-1):
        a = int(35*(i/steps)**2)
        ex = (steps-i)*rx//steps
        ey = (steps-i)*ry//steps
        d.ellipse([cx-rx-ex, cy-ry-ey, cx+rx+ex, cy+ry+ey], fill=(*color, a))
    return Image.alpha_composite(canvas, o)

def iphone_frame(ss_path, out, cw=1080, ch=1920):
    canvas = Image.new("RGBA", (cw, ch))
    canvas.paste(make_gradient(cw, ch, (3,8,20), (8,20,52)), (0,0))
    canvas = glow(canvas, cw//2, ch*3//4, 280, 180, (0,100,255))
    canvas = glow(canvas, cw//2, ch//4, 200, 120, (0,60,180))

    pw = int(cw*0.74)
    ph = int(pw*2.165)
    px = (cw-pw)//2
    py = (ch-ph)//2
    cr = int(pw*0.115)

    # Sombra
    canvas = Image.alpha_composite(canvas, shadow_layer(canvas.size, px, py, pw, ph, cr, 35, 22))
    draw = ImageDraw.Draw(canvas)

    # Corpo titanio
    draw.rounded_rectangle([px,py,px+pw,py+ph], radius=cr, fill=(36,38,44))
    # Borda externa
    for i,c,a in [(1,(160,165,175),200),(2,(100,105,115),100)]:
        draw.rounded_rectangle([px+i-1,py+i-1,px+pw-i+1,py+ph-i+1], radius=cr-i+1, outline=(*c,a), width=1)

    # Tela
    bz = int(pw*0.028)
    sw = pw-bz*2; sh = ph-bz*2
    sr = int(cr*0.82)
    canvas = place_screen(canvas, ss_path, px+bz, py+bz, sw, sh, sr)
    draw = ImageDraw.Draw(canvas)

    # Dynamic Island
    diw = int(pw*0.28); dih = int(pw*0.063)
    dix = px+bz+(sw-diw)//2; diy = py+bz+int(pw*0.018)
    draw.rounded_rectangle([dix,diy,dix+diw,diy+dih], radius=dih//2, fill=(4,4,6))

    # Botão power
    draw.rounded_rectangle([px+pw-2,py+int(ph*0.35),px+pw+5,py+int(ph*0.45)], radius=2, fill=(52,54,60))
    # Botões volume
    draw.rounded_rectangle([px-5,py+int(ph*0.22),px,py+int(ph*0.28)], radius=2, fill=(52,54,60))
    draw.rounded_rectangle([px-5,py+int(ph*0.30),px,py+int(ph*0.36)], radius=2, fill=(52,54,60))

    # Reflexo sutil
    ref = Image.new("RGBA", canvas.size, (0,0,0,0))
    ImageDraw.Draw(ref).polygon([(px+bz,py+bz),(px+bz+int(sw*0.42),py+bz),(px+bz,py+bz+int(sh*0.32))], fill=(255,255,255,7))
    canvas = Image.alpha_composite(canvas, ref)

    canvas.convert("RGB").save(out, "JPEG", quality=96)
    print(f"  ✅ {os.path.basename(out)}")

def macbook_frame(ss_path, out, cw=1920, ch=1080):
    canvas = Image.new("RGBA", (cw, ch))
    canvas.paste(make_gradient(cw, ch, (3,7,18), (10,22,55)), (0,0))
    canvas = glow(canvas, cw//2, ch//2, 480, 280, (0,80,200))

    lw = int(cw*0.76)
    lh = int(lw*0.625)
    lx = (cw-lw)//2
    ly = int(ch*0.04)

    canvas = Image.alpha_composite(canvas, shadow_layer(canvas.size, lx, ly, lw, lh, 18, 30, 22))
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle([lx,ly,lx+lw,ly+lh], radius=18, fill=(33,34,37))
    draw.rounded_rectangle([lx,ly,lx+lw,ly+lh], radius=18, outline=(72,74,82), width=2)

    bh = int(lh*0.042); bs = int(lw*0.022); bb = int(lh*0.048)
    sx = lx+bs; sy = ly+bh; sw = lw-bs*2; sh = lh-bh-bb

    canvas = place_screen(canvas, ss_path, sx, sy, sw, sh, 8)
    draw = ImageDraw.Draw(canvas)

    # Notch
    nw = int(lw*0.058); nh = int(bh*0.8)
    nx = lx+(lw-nw)//2
    draw.rounded_rectangle([nx,ly,nx+nw,ly+nh], radius=5, fill=(33,34,37))

    # Camera
    cx2 = lx+lw//2; cy2 = ly+int(bh*0.45)
    draw.ellipse([cx2-5,cy2-5,cx2+5,cy2+5], fill=(24,24,26))
    draw.ellipse([cx2-2,cy2-2,cx2+2,cy2+2], fill=(40,42,50))

    # Base
    by = ly+lh; bhs = int(lh*0.033)
    tp = int(lw*0.018)
    draw.polygon([(lx+tp,by),(lx+lw-tp,by),(lx+lw-tp+int(lw*0.027),by+bhs),(lx+tp-int(lw*0.027),by+bhs)], fill=(38,39,42))
    draw.line([(lx+tp,by),(lx+lw-tp,by)], fill=(68,70,78), width=2)

    # Reflexo
    ref = Image.new("RGBA", canvas.size, (0,0,0,0))
    ImageDraw.Draw(ref).polygon([(sx,sy),(sx+int(sw*0.38),sy),(sx,sy+int(sh*0.28))], fill=(255,255,255,6))
    canvas = Image.alpha_composite(canvas, ref)

    canvas.convert("RGB").save(out, "JPEG", quality=96)
    print(f"  ✅ {os.path.basename(out)}")

def hero_macbook_iphone(desk_path, mob_path, out, cw=1920, ch=1080):
    canvas = Image.new("RGBA", (cw, ch))
    canvas.paste(make_gradient(cw, ch, (3,7,18), (8,18,50)), (0,0))
    canvas = glow(canvas, int(cw*0.38), ch//2, 420, 260, (0,75,200))
    canvas = glow(canvas, int(cw*0.82), ch//2, 180, 220, (0,55,160))

    # MacBook (esquerda/centro)
    mw = int(cw*0.60); mh = int(mw*0.625)
    mx = int(cw*0.03); my = (ch-mh)//2 - 20

    canvas = Image.alpha_composite(canvas, shadow_layer(canvas.size, mx, my, mw, mh, 16, 28, 18))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle([mx,my,mx+mw,my+mh], radius=16, fill=(33,34,37))
    draw.rounded_rectangle([mx,my,mx+mw,my+mh], radius=16, outline=(70,72,80), width=2)

    bh=int(mh*0.042); bs=int(mw*0.022); bb=int(mh*0.048)
    sx=mx+bs; sy=my+bh; sw=mw-bs*2; sh=mh-bh-bb
    canvas = place_screen(canvas, desk_path, sx, sy, sw, sh, 7)
    draw = ImageDraw.Draw(canvas)

    nw=int(mw*0.057); nh=int(bh*0.78)
    draw.rounded_rectangle([mx+(mw-nw)//2,my,mx+(mw-nw)//2+nw,my+nh], radius=5, fill=(33,34,37))

    # Base MacBook
    bby=my+mh; bbh=int(mh*0.030); tp=int(mw*0.018)
    draw.polygon([(mx+tp,bby),(mx+mw-tp,bby),(mx+mw-tp+int(mw*0.025),bby+bbh),(mx+tp-int(mw*0.025),bby+bbh)], fill=(38,39,42))

    # iPhone (direita)
    pw=int(cw*0.175); ph=int(pw*2.165)
    px=cw-pw-int(cw*0.04); py2=(ch-ph)//2
    cr=int(pw*0.115)

    canvas = Image.alpha_composite(canvas, shadow_layer(canvas.size, px, py2, pw, ph, cr, 25, 18))
    ph_img = Image.new("RGBA", (pw,ph), (0,0,0,0))
    pd = ImageDraw.Draw(ph_img)
    pd.rounded_rectangle([0,0,pw-1,ph-1], radius=cr, fill=(36,38,44))
    pd.rounded_rectangle([0,0,pw-1,ph-1], radius=cr, outline=(72,75,85), width=2)

    bz=int(pw*0.028); isw=pw-bz*2; ish=ph-bz*2; isr=int(cr*0.82)
    try:
        ss_mob = Image.open(mob_path).convert("RGBA").resize((isw,ish), Image.LANCZOS)
        m = rounded_mask((isw,ish), isr)
        ph_img.paste(ss_mob, (bz,bz), m)
    except Exception as e:
        print(f"  Erro mob: {e}")

    pd = ImageDraw.Draw(ph_img)
    diw=int(pw*0.27); dih=int(pw*0.063)
    dix=(pw-diw)//2; diy=bz+int(pw*0.018)
    pd.rounded_rectangle([dix,diy,dix+diw,diy+dih], radius=dih//2, fill=(4,4,6))
    pd.rounded_rectangle([pw-2,int(ph*0.35),pw+5,int(ph*0.45)], radius=2, fill=(52,54,60))
    pd.rounded_rectangle([-5,int(ph*0.22),0,int(ph*0.28)], radius=2, fill=(52,54,60))
    pd.rounded_rectangle([-5,int(ph*0.30),0,int(ph*0.36)], radius=2, fill=(52,54,60))

    tmp = Image.new("RGBA", canvas.size, (0,0,0,0))
    tmp.paste(ph_img, (px,py2), ph_img)
    canvas = Image.alpha_composite(canvas, tmp)

    canvas.convert("RGB").save(out, "JPEG", quality=96)
    print(f"  ✅ {os.path.basename(out)}")

def dual_iphone(ss1, ss2, out, cw=1080, ch=1080):
    import math
    canvas = Image.new("RGBA", (cw, ch))
    canvas.paste(make_gradient(cw, ch, (3,8,18), (10,25,60)), (0,0))
    canvas = glow(canvas, int(cw*0.28), ch//2, 200, 250, (0,90,220))
    canvas = glow(canvas, int(cw*0.72), ch//2, 200, 250, (0,70,190))

    pw = int(cw*0.38); ph = int(pw*2.165)
    cr = int(pw*0.115)

    def make_phone(ss_path, angle):
        p = Image.new("RGBA", (pw,ph), (0,0,0,0))
        d = ImageDraw.Draw(p)
        d.rounded_rectangle([0,0,pw-1,ph-1], radius=cr, fill=(36,38,44))
        d.rounded_rectangle([0,0,pw-1,ph-1], radius=cr, outline=(72,75,85), width=2)
        bz=int(pw*0.028); sw=pw-bz*2; sh=ph-bz*2; sr=int(cr*0.82)
        try:
            ss=Image.open(ss_path).convert("RGBA").resize((sw,sh),Image.LANCZOS)
            m=rounded_mask((sw,sh),sr)
            p.paste(ss,(bz,bz),m)
        except: pass
        d=ImageDraw.Draw(p)
        diw=int(pw*0.27); dih=int(pw*0.063)
        d.rounded_rectangle([(pw-diw)//2,bz+int(pw*0.018),(pw-diw)//2+diw,bz+int(pw*0.018)+dih], radius=dih//2, fill=(4,4,6))
        return p.rotate(angle, expand=False, resample=Image.BICUBIC, center=(pw//2,ph//2))

    p1 = make_phone(ss1, -8)
    p2 = make_phone(ss2, 8)

    for p, center_x in [(p1, int(cw*0.29)), (p2, int(cw*0.71))]:
        ox = center_x - pw//2; oy = (ch-ph)//2
        canvas = Image.alpha_composite(canvas, shadow_layer(canvas.size, ox, oy, pw, ph, cr, 20, 16))
        tmp = Image.new("RGBA", canvas.size, (0,0,0,0))
        tmp.paste(p, (ox, oy), p)
        canvas = Image.alpha_composite(canvas, tmp)

    canvas.convert("RGB").save(out, "JPEG", quality=96)
    print(f"  ✅ {os.path.basename(out)}")

# ─────────────────────────────────────────────────
# SCREENSHOTS DISPONÍVEIS (apenas as não-pretas)
# ─────────────────────────────────────────────────
S = SCREENSHOTS
good_admin_desk = {
    'dashboard':   f'{S}/v3-admin-dashboard.png',
    'requests':    f'{S}/v3-admin-solicitacoes.png',
    'contracts':   f'{S}/v3-admin-contratos.png',
    'metodo':      f'{S}/v3-admin-metodo.png',
    'config':      f'{S}/v3-admin-configuracoes.png',
    'modal':       f'{S}/v3-admin-modal-solicitacao.png',
}
good_client_mob = {
    'dashboard':   f'{S}/v3-mobile-cliente-dashboard.png',
    'perfil':      f'{S}/v3-mobile-cliente-perfil.png',
    'contratos':   f'{S}/v3-mobile-cliente-contratos.png',
    'documentos':  f'{S}/v3-mobile-cliente-documentos.png',
}
landing_desk = f'{S}/v3-landing-topo.png'
landing_mob  = f'{S}/v3-mobile-landing-topo.png'

print("Gerando mockups com screenshots reais...\n")

# iPhone - cliente
print("[iPhone - Cliente]")
iphone_frame(good_client_mob['dashboard'], f'{OUTPUT}/r01-iphone-cliente-dashboard.jpg')
iphone_frame(good_client_mob['perfil'],    f'{OUTPUT}/r02-iphone-cliente-perfil.jpg')
iphone_frame(good_client_mob['contratos'], f'{OUTPUT}/r03-iphone-cliente-contratos.jpg')
iphone_frame(good_client_mob['documentos'],f'{OUTPUT}/r04-iphone-cliente-documentos.jpg')
iphone_frame(landing_mob,                  f'{OUTPUT}/r05-iphone-landing.jpg')

# MacBook - admin
print("\n[MacBook - Admin]")
macbook_frame(good_admin_desk['dashboard'], f'{OUTPUT}/r06-macbook-admin-dashboard.jpg')
macbook_frame(good_admin_desk['requests'],  f'{OUTPUT}/r07-macbook-admin-solicitacoes.jpg')
macbook_frame(good_admin_desk['contracts'], f'{OUTPUT}/r08-macbook-admin-contratos.jpg')
macbook_frame(good_admin_desk['metodo'],    f'{OUTPUT}/r09-macbook-admin-metodo.jpg')
macbook_frame(good_admin_desk['config'],    f'{OUTPUT}/r10-macbook-admin-config.jpg')
macbook_frame(landing_desk,                 f'{OUTPUT}/r11-macbook-landing.jpg')

# Hero shots (MacBook + iPhone)
print("\n[Hero Shots - MacBook + iPhone]")
hero_macbook_iphone(good_admin_desk['dashboard'],  good_client_mob['dashboard'], f'{OUTPUT}/r12-hero-admin-dashboard.jpg')
hero_macbook_iphone(good_admin_desk['requests'],   good_client_mob['contratos'], f'{OUTPUT}/r13-hero-solicitacoes.jpg')
hero_macbook_iphone(good_admin_desk['contracts'],  good_client_mob['perfil'],    f'{OUTPUT}/r14-hero-contratos.jpg')

# Feed quadrado (dois iPhones)
print("\n[Feed Quadrado - Dois iPhones]")
dual_iphone(good_client_mob['dashboard'], good_client_mob['contratos'], f'{OUTPUT}/r15-feed-dois-iphones.jpg')
dual_iphone(good_client_mob['perfil'],    good_client_mob['documentos'],f'{OUTPUT}/r16-feed-perfil-docs.jpg')

print(f"\nTotal: {len([f for f in os.listdir(OUTPUT) if f.startswith('r')])} mockups reais gerados!")
print(f"Pasta: {OUTPUT}")
