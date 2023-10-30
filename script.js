const encoder = new TextEncoder();
const textDecoder = new TextDecoderStream();
const reader = textDecoder.readable.getReader();
let writer;
let coords = []; // [x,y][letter][line]

// Off Paper - 78000
// On Paper  - 80000

const mmToSteps = (mm) => Math.round((mm * 4096) / 9);
const send = async (str) => writer.write(encoder.encode(str + '\n'));
const read = () => reader.read().then(({ value }) => value);
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
    .slice(0, 28);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const svgs = new Array(28)
  .fill(0)
  .map((_, i) => document.querySelector(`#line${i + 1}`));
const getSide = () => document.querySelector('#side').value;
const xToSteps = (mm) => 14000 + mmToSteps(mm);
const yToSteps = (mm, line) => 71200 - mmToSteps(mm + line * 8.7);

const pickSerial = async () => {
  try {
    const pico = await navigator.serial.requestPort();
    await pico.open({ baudRate: 115200 });
    pico.readable.pipeTo(textDecoder.writable);
    writer = pico.writable.getWriter();

    document.querySelector('#overlay').style.display = 'none';
  } catch (e) {
    console.error(e);
  }
};

document.querySelector('#serial').onclick = pickSerial;

const loadText = async () => {
  coords = [];
  svgs.forEach((svg) => (svg.innerHTML = ''));
  const lines = getLines();
  for (const i in lines) {
    const line = lines[i];
    coords.push(
      window.run(line, document.querySelector('#style').value, svgs[i]),
    );
    await wait(1);
  }
};

document.querySelector('#loadText').onclick = loadText;

const write = async () => {
  const commands = coords
    .slice(getSide() === 'top' ? 0 : 14, getSide() === 'top' ? 14 : 28)
    .flatMap((line, i) =>
      line.flatMap((letter) => [
        `${xToSteps(letter[0][0])} ${yToSteps(letter[0][1], i)} 78000`,
        ...letter.map(
          (line) => `${xToSteps(line[0])} ${yToSteps(line[1], i)} 79500`,
        ),
        `${xToSteps(letter[letter.length - 1][0])} ${yToSteps(
          letter[letter.length - 1][1],
          i,
        )} 78000`,
      ]),
    );
  commands.push(commands[commands.length - 1].replace('78000', '70000'));
  send(commands[0]);
  commands.shift();
  while (commands.length) {
    const queueSize = +(await read());
    for (let i = 0; i < queueSize && commands.length; i++) {
      send(commands[0]);
      commands.shift();
    }
  }
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

document.querySelector('#home').onclick = () => send('home');

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
