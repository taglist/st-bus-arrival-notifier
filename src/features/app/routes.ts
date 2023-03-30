import fs from 'fs/promises';
import path from 'path';

import { Router } from 'express';

const router = Router();

const dirPath = path.resolve(__dirname, '../');
const basename = path.basename(__filename);
const extension = `.route${path.extname(basename)}`;

(async () => {
  const features = await fs.readdir(dirPath);

  features
    .filter(feature => feature !== 'app')
    .forEach(async feature => {
      const routePath = path.resolve(dirPath, feature, 'routes');
      const files = await fs.readdir(routePath);

      files.forEach(async file => {
        const filePath = path.resolve(routePath, file);
        const routeName = path.basename(file, extension);
        const url = `/${routeName}/${feature}`;

        router.use(url, (await import(filePath)).default);
      });
    });
})();

export default router;
