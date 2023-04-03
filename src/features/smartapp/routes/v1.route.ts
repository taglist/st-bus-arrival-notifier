import { Router } from 'express';

import smartApp from '../smartApp';

const router = Router();

router.post('/', (req, res) => {
  return smartApp.handleHttpCallback(req, res);
});

export default router;
