import os
from django.core.files.base import ContentFile


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
