import os

from django.core.files.base import ContentFile

# Cualquier formato que Pillow sepa abrir sin plugins extra. HEIC (fotos de
# iPhone compartidas fuera del navegador) queda fuera a propósito: requeriría
# la dependencia pillow-heif, que este backbone no trae.
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff')


def is_image_upload(uploaded_file):
    """¿El archivo subido es una imagen que compress_image puede abrir?"""
    return bool(uploaded_file) and uploaded_file.name.lower().endswith(IMAGE_EXTENSIONS)


def compress_image(image_file, max_size=(1920, 1920), quality=85):
    """
    Compress and resize image using Pillow.

    Args:
        image_file: Django UploadedFile object
        max_size: Maximum dimensions (width, height)
        quality: JPEG quality (1-100)

    Returns:
        ContentFile with compressed image, or original if compression fails
    """
    try:
        from PIL import Image
        from io import BytesIO

        img = Image.open(image_file)

        # Convert RGBA/palette to RGB
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background

        img.thumbnail(max_size, Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)

        filename = os.path.splitext(os.path.basename(image_file.name))[0] + '.jpg'
        return ContentFile(output.read(), name=filename)

    except Exception as e:
        print(f"Image compression error: {e}")
        return image_file


def compress_if_image(uploaded_file, max_size=(1920, 1920), quality=85):
    """
    Comprime `uploaded_file` si es una imagen soportada; si no (PDF u otro
    formato que este backbone no reconoce como imagen), lo devuelve intacto.

    Punto único para todo el backbone: un campo de carga nuevo en cualquier
    app llama a esta función y queda cubierto, sin repetir el chequeo de
    extensión en cada modelo.
    """
    if not is_image_upload(uploaded_file):
        return uploaded_file
    return compress_image(uploaded_file, max_size=max_size, quality=quality)
