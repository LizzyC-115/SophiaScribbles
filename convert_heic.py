#!/usr/bin/env python3
"""Convert all HEIC/HEIF images in a folder to JPEG."""

from pathlib import Path
from typing import Iterable

from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()


def iter_heic_files(base_path: Path) -> Iterable[Path]:
    pattern = "*.[hH][eE][iI][cC]"
    for file in base_path.rglob(pattern):
        if file.is_file():
            yield file


def convert_directory(directory: str) -> None:
    images_path = Path(directory).expanduser().resolve()

    if not images_path.exists():
        raise FileNotFoundError(f"Directory not found: {images_path}")

    for image_file in iter_heic_files(images_path):
        print(f"Converting: {image_file.name}")
        try:
            with Image.open(image_file) as image:
                new_name = image_file.with_suffix('.jpg')
                image.convert('RGB').save(new_name, 'JPEG', quality=90)
                print(f"  ✓ Saved as: {new_name.name}")
        except Exception as exc:  # pylint: disable=broad-except
            print(f"  ✗ Error converting {image_file.name}: {exc}")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Convert HEIC/HEIF images to JPEG.')
    parser.add_argument('directory', nargs='?', default='uploads',
                        help='Directory containing HEIC files (default: ./uploads)')
    args = parser.parse_args()

    convert_directory(args.directory)
