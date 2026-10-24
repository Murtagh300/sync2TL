import axios, { type AxiosInstance } from 'axios'
import { defineBoot } from '#q-app'

declare module 'vue' {
    interface ComponentCustomProperties {
        $axios: AxiosInstance
    }
}

export default defineBoot(({ app }) => {
    app.config.globalProperties.$axios = axios.create({ timeout: 30 * 1000 })
})
