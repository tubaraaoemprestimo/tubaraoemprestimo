import requests
import os
import sys

API_KEY = "sk-KkQu5Da6afz7stxjtQhtUL5XYB2qG2he5ucvXb1ALoDcrAlX"
ENDPOINT = "https://api.stability.ai/v2beta/stable-image/generate/ultra"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

IMAGES = [
    {
        "filename": "aprovacao-rapida.png",
        "aspect_ratio": "9:16",
        "prompt": (
            "cinematic close-up of a real human hand holding a modern iPhone 15 Pro in a trendy coffee shop, "
            "natural soft window light, the phone screen shows a green notification banner with a shark logo and "
            "text 'Crédito Pré-Aprovado! R$ 15.000' in white text on dark background, shallow depth of field "
            "f/1.8 bokeh background with blurred coffee cups, photorealistic, commercial photography, 8k, "
            "professional lighting, warm ambient tones"
        ),
    },
    {
        "filename": "admin-escritorio.png",
        "aspect_ratio": "16:9",
        "prompt": (
            "cinematic medium shot of a confident Brazilian fintech entrepreneur in his 30s sitting at a glass desk "
            "in a modern minimalist office, pointing at a large curved ultrawide monitor showing a dark dashboard "
            "with analytics charts and loan management tables, blue and white accent colors, professional business "
            "attire, ambient LED lighting, shallow depth of field, commercial photography style, 8k resolution, "
            "corporate fintech aesthetic"
        ),
    },
    {
        "filename": "aprovacao-celular-mao.png",
        "aspect_ratio": "1:1",
        "prompt": (
            "overhead flat lay shot on dark slate surface, iPhone 15 Pro showing a fintech loan approval screen "
            "with shark branding, next to a credit card, small succulent plant, modern pen and notebook, perfect "
            "product photography lighting with soft shadows, dark moody professional aesthetic, 8k commercial photography"
        ),
    },
    {
        "filename": "lifestyle-cliente-aprovado.png",
        "aspect_ratio": "16:9",
        "prompt": (
            "cinematic lifestyle shot of a happy young Brazilian man in his late 20s, smiling while looking at his "
            "smartphone in an urban setting, modern city background slightly blurred, he is wearing casual smart "
            "clothes, golden hour lighting from the side, the phone screen has a green approval glow, professional "
            "commercial photography, 8k, warm tones, Brazilian aesthetic"
        ),
    },
    {
        "filename": "banner-hero.png",
        "aspect_ratio": "16:9",
        "prompt": (
            "epic cinematic wide shot of a sleek dark fintech office space at night, large floor-to-ceiling windows "
            "overlooking a city skyline, multiple curved monitors showing financial dashboards with blue data "
            "visualizations, empty designer chairs, dramatic blue and purple ambient lighting, smoke/mist effect, "
            "professional architectural photography, ultra wide angle, 8k resolution, luxury fintech brand aesthetic"
        ),
    },
    {
        "filename": "stories-aprovado.png",
        "aspect_ratio": "9:16",
        "prompt": (
            "vertical format cinematic shot of a Brazilian woman in her 30s celebrating with raised fist, holding "
            "smartphone showing green check mark approval notification, modern apartment background softly blurred, "
            "confetti falling, warm golden light, authentic emotion of financial freedom, commercial photography, "
            "8k, vibrant joyful colors"
        ),
    },
]

def generate_image(image_config):
    filename = image_config["filename"]
    output_path = os.path.join(OUTPUT_DIR, filename)

    print(f"\n[→] Gerando: {filename} ({image_config['aspect_ratio']})...")

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "image/*",
    }

    data = {
        "prompt": image_config["prompt"],
        "aspect_ratio": image_config["aspect_ratio"],
        "output_format": "png",
    }

    try:
        # Build multipart/form-data with only text fields (no file upload needed)
        multipart_data = {k: (None, v) for k, v in data.items()}

        response = requests.post(
            ENDPOINT,
            headers=headers,
            files=multipart_data,
            timeout=120,
        )

        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            size_kb = len(response.content) / 1024
            print(f"    [✓] Salvo: {output_path} ({size_kb:.1f} KB)")
            return True
        else:
            print(f"    [✗] ERRO {response.status_code}: {response.text[:300]}")
            return False

    except Exception as e:
        print(f"    [✗] Exceção: {e}")
        return False


def main():
    print("=" * 60)
    print("  Tubarão Empréstimos — Gerador de Imagens Cinematográficas")
    print("  Stability AI Ultra — 6 imagens")
    print("=" * 60)

    results = {}
    for img in IMAGES:
        success = generate_image(img)
        results[img["filename"]] = success

    print("\n" + "=" * 60)
    print("  RESUMO")
    print("=" * 60)
    ok = [k for k, v in results.items() if v]
    fail = [k for k, v in results.items() if not v]

    for name in ok:
        print(f"  ✓  {name}")
    for name in fail:
        print(f"  ✗  {name}")

    print(f"\n  Total: {len(ok)}/{len(IMAGES)} geradas com sucesso")
    print(f"  Pasta: {OUTPUT_DIR}")

    return 0 if not fail else 1


if __name__ == "__main__":
    sys.exit(main())
