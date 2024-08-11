import 'dotenv/config'
import { app } from '@azure/functions';

app.setup({
    enableHttpStream: true,
});
