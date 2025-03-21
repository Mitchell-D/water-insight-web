const name = "canvas_render";

const cxt = document.getElementById("main_data_render")

function drawSquare(length, x, y, color) {
  cxt.fillStyle = color;
  cxt.fillRect(x, y, length, length);

  return { length, x, y, color };
}

function updateImage(img) {
    /* drawImage(image, sx, sy, swidth, sheight, dx, dy, dwidth, dheight) */
    cxt.drawImage(img);
}

export {name, drawSquare};