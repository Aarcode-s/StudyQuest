/** Draws the Foco pom-pom mascot on a canvas. (ox, oy) is the top-left of a 100 x 100 box, s the scale. */
export function drawPom(g: CanvasRenderingContext2D, ox: number, oy: number, s: number, edge = "#3b2a1e") {
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const ink = "#3b2a1e";
  const fur = "#ebb52e";
  const dot = (x: number, y: number, r: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(X(x), Y(y), r * s, 0, Math.PI * 2);
    g.fill();
  };
  const bumps: [number, number][] = Array.from({ length: 12 }, (_, i) => {
    const a = (2 * Math.PI * i) / 12;
    return [50 + 25 * Math.cos(a), 58 + 25 * Math.sin(a)];
  });
  g.fillStyle = edge;
  [40, 60].forEach((x) => {
    g.beginPath();
    g.ellipse(X(x), Y(94), 5.5 * s, 3.4 * s, 0, 0, Math.PI * 2);
    g.fill();
  });
  bumps.forEach(([x, y]) => dot(x, y, 11.4, edge));
  dot(50, 58, 27.4, edge);
  bumps.forEach(([x, y]) => dot(x, y, 8.7, fur));
  dot(50, 58, 25, fur);
  dot(33, 65, 4.2, "rgba(226, 119, 46, 0.6)");
  dot(67, 65, 4.2, "rgba(226, 119, 46, 0.6)");

  g.lineWidth = 3.2 * s;
  g.lineCap = "round";
  const curve = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(X(x0), Y(y0));
    g.quadraticCurveTo(X(cx), Y(cy), X(x1), Y(y1));
    g.stroke();
  };
  g.strokeStyle = edge;
  curve(50, 27, 50, 15, 42, 13);
  curve(50, 27, 52, 14, 60, 14);
  g.strokeStyle = ink;
  curve(34.5, 55, 39, 60, 43.5, 55);
  curve(56.5, 55, 61, 60, 65.5, 55);
  curve(46.5, 67, 50, 70.5, 53.5, 67);
}
