import { APP } from '@/config';
import { app } from '@/features/app';

const { port } = APP;

// eslint-disable-next-line no-console
app.listen(port, () => console.info(`🚀 Server listening on port ${port}`));
