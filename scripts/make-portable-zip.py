"""把 release/win-unpacked 打包成带顶层 SkillTree 目录的免安装 ZIP。

用法：python scripts/make-portable-zip.py <源目录> <输出 zip> <启动说明.txt>
"""
from __future__ import annotations

import os
import sys
import zipfile

src, dst, instructions = sys.argv[1], sys.argv[2], sys.argv[3]
skip_dirs = {".skilltree-userdata", "我的技能树"}

with zipfile.ZipFile(dst, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
    for root, dirs, files in os.walk(src):
        dirs[:] = sorted(d for d in dirs if d not in skip_dirs)
        for name in sorted(files):
            path = os.path.join(root, name)
            rel = os.path.relpath(path, src)
            archive.write(path, os.path.join("SkillTree", rel))
    if instructions and os.path.exists(instructions):
        archive.write(
            instructions,
            os.path.join("SkillTree", os.path.basename(instructions)),
        )

print(f"portable zip: {dst} ({os.path.getsize(dst)} bytes)")
