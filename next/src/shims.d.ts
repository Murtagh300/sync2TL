declare module 'more-entropy' {
    const moreEntropy: {
        Generator: new () => {
            generate(bits: number, cb: (entropy: number[]) => void): void
        }
    }
    export default moreEntropy
}
