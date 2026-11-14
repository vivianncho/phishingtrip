/**
 * Put exported layers into one coordinate system. Nested SVG viewports can
 * clip positioned layers differently on native renderers; translated groups
 * preserve the source geometry without creating additional clipping boxes.
 */
export function nativeHookXml(layers: string[]): string {
  const groups = layers.map(layer => {
    const match = layer.trim().match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
    if (!match) throw new Error('Invalid Hook artwork');
    const attr = (name: string) => match[1].match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
    const x = Number(attr('x') ?? 0), y = Number(attr('y') ?? 0);
    const width = Number(attr('width')), height = Number(attr('height'));
    const box = (attr('viewBox') ?? '').trim().split(/\s+/).map(Number);
    if (![x, y, width, height, ...box].every(Number.isFinite) || box.length !== 4 || box[2] <= 0 || box[3] <= 0) {
      throw new Error('Invalid Hook artwork bounds');
    }
    return `<g transform="translate(${x} ${y}) scale(${width / box[2]} ${height / box[3]}) translate(${-box[0]} ${-box[1]})">${match[2]}</g>`;
  });
  return `<svg viewBox="0 0 480 400" fill="none" xmlns="http://www.w3.org/2000/svg">${groups.join('')}</svg>`;
}
