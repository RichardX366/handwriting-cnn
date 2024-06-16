const encoder = new TextEncoder();
const textDecoder = new TextDecoderStream();
const reader = textDecoder.readable.getReader();
let writer;
let coords = []; // [x,y][letter][line]
const streamData = [];

const ding = new Audio('ding.mp3');

const reLU = (x) => (x > 0 ? x : 0);
const send = async (str) => writer.write(encoder.encode(str + '\n'));
const read = async () => {
  if (streamData.length) return streamData.shift();
  let output = '';
  let { value } = await reader.read();
  output += value;
  while (!value.includes('\n')) {
    ({ value } = await reader.read());
    output += value;
  }
  if (output.split('\n').length > 2) {
    streamData.push(...output.split('\n').slice(1).filter(Boolean));
  }
  return output.split('\n')[0];
};
const getLines = () => {
  const initial = document
    .querySelector('textarea')
    .value.replaceAll('\t', '  ')
    .split('\n');
  return initial
    .flatMap((line) => {
      const spacingSize = line.length - line.trimStart().length;
      const spacing = new Array(spacingSize).fill(' ').join('');
      let remaining = line.trimStart();
      const result = [];
      while (remaining.length > 63 - spacingSize) {
        const split = remaining.slice(0, 64 - spacingSize).split(' ');
        const toAdd = split.slice(0, split.length - 1).join(' ');
        result.push(spacing + toAdd);
        remaining = remaining.slice(toAdd.length + 1);
      }
      result.push(spacing + remaining);
      return result;
    })
    .slice(0, 27);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const svgs = new Array(27)
  .fill(0)
  .map((_, i) => document.querySelector(`#line${i + 1}`));
const getSide = () => document.querySelector('#side').value;
const getX = (mm, y) =>
  23 +
  mm +
  ((Math.sin((y / 4.5) * 2 * Math.PI) / 4) * (130 - y - 2 * reLU(30 - y))) /
    130;
const getY = (mm, line) => 123 - mm - line * 8.7;
const getZ = (x, y) => 27.3 - ((x / 68) * (180 - y)) / 180 - 1.3 * (y / 130);
const pickSerial = async () => {
  try {
    const pico = await navigator.serial.requestPort();
    await pico.open({ baudRate: 115200 });
    pico.readable.pipeTo(textDecoder.writable);
    writer = pico.writable.getWriter();
    pico.ondisconnect = () => {
      writer = null;
      coords = [];
      document.querySelector('#overlay').style.display = '';
    };

    document.querySelector('#overlay').style.display = 'none';
  } catch (e) {
    console.error(e);
  }
};

document.querySelector('#serial').onclick = pickSerial;

const loadText = async () => {
  document.querySelector('#loadText').disabled = true;
  document
    .querySelectorAll('#paper button')
    .forEach((button) => (button.disabled = true));
  coords = [];
  svgs.forEach((svg) => (svg.innerHTML = ''));
  const lines = getLines();
  for (const i in lines) {
    const line = lines[i];
    coords.push(
      await window.run(line, document.querySelector('#style').value, svgs[i]),
    );
  }
  document.querySelector('#loadText').disabled = false;
  document
    .querySelectorAll('#paper button')
    .forEach((button) => (button.disabled = false));
};

document.querySelector('#loadText').onclick = loadText;

const alignPencil = async () => {
  await send('G0 X40 Y40 Z24');
  await read();
};

document.querySelector('#alignPencil').onclick = alignPencil;

const write = async () => {
  const commands = coords
    .slice(getSide() === 'top' ? 0 : 14, getSide() === 'top' ? 14 : 27)
    .flatMap((line, lineIndex) =>
      line
        .flatMap((letter, i) => {
          const firstY = getY(letter[0][1], lineIndex);
          const firstX = getX(letter[0][0], firstY);
          const lastY = getY(letter[letter.length - 1][1], lineIndex);
          const lastX = getX(letter[letter.length - 1][0], lastY);

          const letterCommands = [
            `G0 X${firstX} Y${firstY} Z23`,
            ...letter.map((stroke) => {
              const y = getY(stroke[1], lineIndex);
              const x = getX(stroke[0], y);
              const z = getZ(x, y);

              return `G1 X${x} Y${y} Z${z}`;
            }),
            `G0 X${lastX} Y${lastY} Z23`,
          ];
          if (i % 2) letterCommands.reverse();
          return letterCommands;
        })
        .concat(...(line.length ? ['home'] : [])),
    );
  await send('G1 F999');
  await read();
  while (commands.length) {
    if (commands[0].split('Z')[1] === '23') await waitForIdle();
    if (commands[0] === 'home') {
      await waitForIdle();
      await home();
    } else {
      await send(commands[0]);
      await read();
    }
    commands.shift();
  }
  ding.play();
  console.log('Done');
};

document.querySelector('#write').onclick = write;

document.querySelectorAll('#paper button').forEach(
  (button) =>
    (button.onclick = (e) => {
      const i = e.target.parentElement.children[0].id.substring(4) - 1;
      if (!getLines()[i]) return;
      coords[i] = window.run(
        getLines()[i],
        document.querySelector('#style').value,
        svgs[i],
      );
    }),
);

const getMode = async () => {
  await send('?');
  const response = await read();
  await read();
  return response.split('<')[1].split('|')[0];
};

const waitForIdle = async () => {
  let mode = await getMode();
  while (mode !== 'Idle') {
    await wait(200);
    mode = await getMode();
  }
};

const home = async () => {
  document.querySelector('#home').disabled = true;
  document.querySelector('#alignPencil').disabled = true;
  document.querySelector('#write').disabled = true;
  await send('$J=X-10 Y-10 Z-10 F999');
  await read();
  await waitForIdle();
  await send('$J=X0 Y0 Z0 F999');
  await read();
  await waitForIdle();
  await send('$H');
  await read();
  await read();
  await read();
  document.querySelector('#home').disabled = false;
  document.querySelector('#alignPencil').disabled = false;
  document.querySelector('#write').disabled = false;
};

document.querySelector('#home').onclick = home;

document.querySelector('#side').onchange = (e) => {
  if (e.target.value === 'top') {
    svgs
      .slice(0, 14)
      .forEach((svg) => (svg.style.backgroundColor = 'lightcyan'));
    svgs.slice(14).forEach((svg) => (svg.style.backgroundColor = 'white'));
  } else {
    svgs.slice(0, 14).forEach((svg) => (svg.style.backgroundColor = 'white'));
    svgs.slice(14).forEach((svg) => (svg.style.backgroundColor = 'lightcyan'));
  }
};

svgs.slice(0, 14).forEach((svg) => (svg.style.backgroundColor = 'lightcyan'));

const sendCustomCommand = () => {
  const command = document.querySelector('#custom').value;
  if (!command) return;
  document.querySelector('#custom').value = '';
  send(command);
};

document.querySelector('#custom').onkeypress = (e) => {
  if (e.key === 'Enter') sendCustomCommand();
};
document.querySelector('#customBtn').onclick = sendCustomCommand;
