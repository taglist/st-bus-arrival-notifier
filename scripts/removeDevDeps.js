const fs = require('fs/promises');

(async () => {
  try {
    const file = await fs.readFile('package.json', 'utf-8');
    const data = JSON.parse(file);

    delete data.devDependencies;
    await fs.writeFile('package.json', JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(err);
  }
})();
