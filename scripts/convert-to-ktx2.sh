#!/bin/bash
set -e
PUBLIC="/Users/kusudam/Documents/[Claude] Fig.1/project-year-books/public"
DIRS="covers fronts spines backs"
total=0
done=0

for dir in $DIRS; do
  count=$(ls "$PUBLIC/$dir/"*.webp 2>/dev/null | wc -l)
  total=$((total + count))
done
echo "총 ${total}개 변환 시작..."

for dir in $DIRS; do
  for f in "$PUBLIC/$dir/"*.webp; do
    [ -f "$f" ] || continue
    name=$(basename "$f" .webp)
    tmp="/tmp/ktx2_${dir}_${name}.png"
    out="$PUBLIC/$dir/${name}.ktx2"
    sips -s format png "$f" --out "$tmp" > /dev/null 2>&1
    toktx --encode etc1s --clevel 4 --qlevel 192 --lower_left_maps_to_s0t0 "$out" "$tmp" > /dev/null 2>&1
    rm -f "$tmp"
    done=$((done + 1))
    printf "\r  ${done}/${total} — ${dir}/${name}.ktx2"
  done
done

echo
echo "완료! ${done}개 ktx2 생성됨"
