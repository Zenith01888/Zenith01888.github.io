from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
PROJECTS = IMG / "projects"

BG = (15, 18, 23, 255)
PANEL = (22, 27, 34, 255)
CORAL = (240, 98, 60)
TEAL = (45, 184, 162)
AMBER = (230, 182, 76)
CREAM = (244, 241, 234)


def alpha(color, value):
    return color + (value,)


def draw_grid(draw, width, height, step, color):
    for x in range(0, width, step):
        draw.line((x, 0, x, height), fill=color, width=1)
    for y in range(0, height, step):
        draw.line((0, y, width, y), fill=color, width=1)


def save_supersampled(image, path, scale=2):
    image = image.resize((image.width // scale, image.height // scale), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def make_project_cover(name, drawing):
    size = (1200, 750)
    canvas = Image.new("RGBA", (size[0] * 2, size[1] * 2), PANEL)
    draw = ImageDraw.Draw(canvas)
    draw_grid(draw, canvas.width, canvas.height, 96, alpha(CREAM, 10))
    drawing(draw, canvas.width, canvas.height)
    save_supersampled(canvas, PROJECTS / name)


def draw_pdf_cover(draw, width, height):
    sheets = [
        ((0.32, 0.2), CORAL),
        ((0.4, 0.34), TEAL),
        ((0.48, 0.48), AMBER),
    ]
    for (x, y), color in sheets:
        x1, y1 = width * x, height * y
        x2, y2 = x1 + width * 0.3, y1 + height * 0.28
        draw.rounded_rectangle((x1, y1, x2, y2), radius=16, fill=alpha(color, 175))
        draw.rectangle((x1 + 28, y1 + 28, x1 + width * 0.14, y1 + 44), fill=alpha(CREAM, 130))
        draw.rectangle((x1 + 28, y1 + 68, x1 + width * 0.21, y1 + 78), fill=alpha(CREAM, 90))
        draw.rectangle((x1 + 28, y1 + 94, x1 + width * 0.17, y1 + 104), fill=alpha(CREAM, 90))


def draw_pwm_cover(draw, width, height):
    left, top, right, bottom = width * 0.1, height * 0.14, width * 0.9, height * 0.86
    draw.rounded_rectangle(
        (left, top, right, bottom),
        radius=24,
        fill=alpha(CREAM, 18),
        outline=alpha(CREAM, 60),
        width=2,
    )

    traces = [
        (height * 0.35, width * 0.1, 0.5, CORAL),
        (height * 0.58, width * 0.15, 0.3, TEAL),
        (height * 0.81, width * 0.075, 0.7, AMBER),
    ]
    for y, period, duty, color in traces:
        amp = height * 0.035
        x = left + width * 0.025
        while x < right - width * 0.025:
            high = x + period * duty
            low = x + period
            draw.line((x, y - amp, high, y - amp), fill=alpha(color, 230), width=4)
            draw.line((high, y - amp, high, y + amp), fill=alpha(color, 230), width=4)
            draw.line((high, y + amp, low, y + amp), fill=alpha(color, 230), width=4)
            draw.line((low, y + amp, low, y - amp), fill=alpha(color, 230), width=4)
            x = low

    labels = [
        (left + width * 0.045, height * 0.235, CORAL),
        (left + width * 0.045, height * 0.465, TEAL),
        (left + width * 0.045, height * 0.695, AMBER),
    ]
    for x, y, color in labels:
        draw.rounded_rectangle(
            (x, y - 24, x + width * 0.13, y + 8),
            radius=8,
            fill=alpha(color, 220),
        )


def draw_portfolio_cover(draw, width, height):
    left = width * 0.28
    top = height * 0.2
    bar_w = width * 0.09
    cross_w = width * 0.42
    bar_h = height * 0.56
    cross_h = height * 0.13

    draw.rectangle((left, top, left + bar_w, top + bar_h), fill=alpha(TEAL, 210))
    draw.rectangle(
        (left + cross_w - bar_w, top, left + cross_w, top + bar_h),
        fill=alpha(CORAL, 210),
    )
    draw.rectangle(
        (left + bar_w - 18, top + bar_h * 0.42, left + cross_w - bar_w + 18, top + bar_h * 0.42 + cross_h),
        fill=alpha(CREAM, 235),
    )
    draw.rectangle((width * 0.08, height * 0.08, width * 0.16, height * 0.16), fill=alpha(AMBER, 220))


def draw_lab_cover(draw, width, height):
    nodes = [
        (width * 0.16, height * 0.22),
        (width * 0.42, height * 0.16),
        (width * 0.72, height * 0.28),
        (width * 0.84, height * 0.56),
        (width * 0.6, height * 0.72),
        (width * 0.28, height * 0.58),
        (width * 0.5, height * 0.46),
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 0), (1, 6), (6, 4), (6, 2)]
    for a, b in edges:
        draw.line((*nodes[a], *nodes[b]), fill=alpha(CREAM, 90), width=3)
    for index, (x, y) in enumerate(nodes):
        color = (CORAL, TEAL, AMBER)[index % 3]
        draw.rounded_rectangle((x - 18, y - 18, x + 18, y + 18), radius=6, fill=alpha(color, 220))
    draw.line((width * 0.1, height * 0.82, width * 0.9, height * 0.82), fill=alpha(AMBER, 150), width=4)


def make_favicon():
    size = 512
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((16, 16, size - 16, size - 16), radius=96, fill=CORAL)

    bar_w = size * 0.11
    left = size * 0.28
    right = size * 0.61
    top = size * 0.25
    bottom = size * 0.75
    cross_h = size * 0.14

    draw.rectangle((left, top, left + bar_w, bottom), fill=CREAM)
    draw.rectangle((right, top, right + bar_w, bottom), fill=CREAM)
    draw.rectangle(
        (left + bar_w - 8, size * 0.43, right - bar_w + 8, size * 0.43 + cross_h),
        fill=CREAM,
    )
    save_supersampled(canvas, IMG / "favicon.png")


if __name__ == "__main__":
    make_project_cover("project-pdfmerge.png", draw_pdf_cover)
    make_project_cover("project-pwm.png", draw_pwm_cover)
    make_project_cover("project-portfolio.png", draw_portfolio_cover)
    make_project_cover("project-lab.png", draw_lab_cover)
    make_favicon()
