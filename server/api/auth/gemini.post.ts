import {GoogleGenerativeAI} from '@google/generative-ai'
import {GeminiReq} from "~/server/utils/types";
import {headers} from "~/server/utils/helper";

const genAI = new GoogleGenerativeAI(process.env.G_API_KEY!)

export default defineEventHandler(async (event) => {
    const body: GeminiReq = await readBody(event)
    const {model, messages} = body

    const m = genAI.getGenerativeModel({model})
    let msg = messages.slice(1)
    let flag = ['user', 'assistant']
    for (let i = 0; i < msg.length; i++) {
        if (msg[i].role !== flag[i % 2]) {
            flag = []
            break
        }
    }
    if (!flag.length) return new Response('对话失效，请重新开始对话', {status: 400})
    const chat = m.startChat({
        history: msg.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role === 'user' ? 'user' : 'function',
            parts: [{text: m.content}]
        }))
    })
    const res = await chat.sendMessageStream(msg[msg.length - 1].content)

    const textEncoder = new TextEncoder()
    const readableStream = new ReadableStream({
        async start(controller) {
            for await (const chunk of res.stream) {
                try {
                    controller.enqueue(textEncoder.encode(chunk.text()))
                } catch (e) {
                    console.error(e)
                    controller.enqueue(textEncoder.encode('已触发安全限制，请重新开始对话'))
                }
            }

            controller.close()
        }
    })

    return new Response(readableStream, {
        headers,
    })
})