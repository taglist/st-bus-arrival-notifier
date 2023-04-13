import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { errorHandler, responseWrapper } from '@/lib/middlewares';

import router from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('common'));
app.use(express.static('public'));

app.use(responseWrapper);
app.use(router);
app.use(errorHandler);

export default app;
