import { migrate } from './migrations'

// imported first by App.vue: settings are migrated before any module reads them
try {
    migrate(localStorage)
} catch { }
