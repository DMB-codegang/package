import { Context, Hono } from 'hono'
import { Bindings } from '../index'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// 快递入库接口参数校验
const packageCheckInSchema = z.object({
    tracking_number: z.string().min(1, "Tracking number is required"),
    carrier: z.string().min(1, "Carrier is required"),
    guest_name: z.string().default("无名"),
    room_number: z.string().optional(),
    guest_phone: z.string().optional(),
    received_by: z.string().min(1, "Received by is required"),
    notes: z.string().optional(),
}).refine(
    (data) => data.room_number || data.guest_phone,
    {
        message: "至少需要提供房间号或客人电话中的一项",
        path: ["room_number", "guest_phone"]
    }
);

// 快递出库接口参数校验
const packageCheckOutSchema = z.object({
    tracking_number: z.string().min(1, "Tracking number is required"),
    picked_up_by: z.string().min(1, "Picked up by is required"),
    notes: z.string().optional(),
})

export class PackageService {
    static register(app: Hono<{ Bindings: Bindings }>) {
        app.get('/api/packages/search', (c) => this.searchPackage(c))

        app.get('/api/packages/getlist', (c) => this.getPackageList(c))

        app.post('/api/packages/checkin', zValidator('json', packageCheckInSchema), async (c) => {
            try {
                const body = c.req.valid('json')

                // 检查快递是否存在
                const packageExists = await c.env.packageData.prepare(`
                SELECT id, notes FROM packages WHERE tracking_number = ?
                `).bind(body.tracking_number).run()

                // 如果存在，返回信息提示已经入库
                if (packageExists.results.length > 0) {
                    return c.json({
                        success: false,
                        error: '库中已有该包裹',
                        details: 'Tracking number already exists'
                    }, 409);
                }

                // 插入数据库
                await c.env.packageData.prepare(`
                INSERT INTO packages (
                    tracking_number, carrier,
                    guest_name, room_number, guest_phone,
                    status, received_by, notes
                ) VALUES (
                    ?, ?,
                    ?, ?, ?,
                    '已接收', ?, ?
                )
                `).bind(
                    body.tracking_number, body.carrier, body.guest_name, body.room_number || null, body.guest_phone || null, body.received_by, body.notes || null
                ).run()

                // 返回成功响应
                return c.json({
                    success: true,
                    message: '包裹已成功入库',
                    data: body
                })
            } catch (error) {
                // 原有的错误处理
                return c.json({
                    success: false,
                    error: '包裹入库失败：未知错误',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }, 500);
            }
        })

        app.post('/api/packages/checkout', zValidator('json', packageCheckOutSchema), async (c) => {
            try {
                const body = c.req.valid('json')

                // 更新数据库
                return await this.updatePackage(c, {
                    tracking_number: body.tracking_number,
                    picked_up_by: body.picked_up_by,
                    status: '已领取',
                    notes: body.notes
                })

            } catch (error) {
                // 原有的错误处理
                return c.json({
                    success: false,
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }, 500);
            }
        })
    }

    private static async searchPackage(c: Context<{ Bindings: Bindings }>) {
        const query = c.req.query()

        // 构建sql查询语句
        let sql = `SELECT * FROM packages WHERE 1=1`
        const params: string[] = []
        
        if (query.tracking_number) {
            sql += ` AND tracking_number LIKE ?`
            params.push(`%${query.tracking_number}%`)
        }
        if (query.carrier) {
            sql += ` AND carrier LIKE ?`
            params.push(`%${query.carrier}%`)
        }
        if (query.guest_name) {
            sql += ` AND guest_name LIKE ?`
            params.push(`%${query.guest_name}%`)
        }
        if (query.room_number) {
            sql += ` AND room_number LIKE ?`
            params.push(`%${query.room_number}%`)
        }
        if (query.guest_phone) {
            sql += ` AND guest_phone LIKE ?`
            params.push(`%${query.guest_phone}%`)
        }
        if (query.status) {
            sql += ` AND status = ?`
            params.push(query.status)
        }

        // 执行查询
        const packages = await c.env.packageData.prepare(sql).bind(...params).run()
        return c.json(packages.results)
    }

    private static async getPackageList(c: Context<{ Bindings: Bindings }>) {
        const packages = await c.env.packageData.prepare(`
            SELECT * FROM packages
        `).run()
        return c.json(packages.results)
    }

    private static async updatePackage(c: Context<{ Bindings: Bindings }>, updates: {
        tracking_number: string,
        picked_up_by: string,
        status: string,
        notes?: string
    }) {
         // 检查快递是否存再并检查是否有note
                const packageExists = await c.env.packageData.prepare(`
                SELECT id,notes FROM packages WHERE tracking_number = ?
                `).bind(updates.tracking_number).run()

                if (!packageExists.results.length) {
                    return c.json({
                        success: false,
                        error: 'Package not found',
                        details: 'Tracking number does not exist'
                    }, 404);
                }
                updates.notes = packageExists.results[0].notes ? packageExists.results[0].notes + ',' + updates.notes || '' : updates.notes || ''

                // 更新数据库
                await c.env.packageData.prepare(`
                UPDATE packages
                SET status = '已领取',
                    pickup_time = CURRENT_TIMESTAMP,
                    picked_up_by = ?,
                    notes = ?
                WHERE tracking_number = ?
                `).bind(
                    updates.picked_up_by, updates.notes, updates.tracking_number
                ).run()

                return c.json({
                    success: true,
                    message: 'Package checked out successfully',
                    data: updates
                })
    }

}