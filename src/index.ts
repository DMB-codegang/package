import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  packageData: D1Database;
};

/* 
快递管理软件后端api
*/

const app = new Hono<{ Bindings: Bindings }>()

app.all('*', (c) => {
  c.env.packageData.prepare(`
    CREATE TABLE IF NOT EXISTS packages (
    -- 主键标识
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 快递基本信息
    tracking_number VARCHAR(50) NOT NULL,        -- 快递单号
    carrier VARCHAR(50),                         -- 快递公司（顺丰、圆通等）
    
    -- 收件人信息（酒店客人）
    guest_name VARCHAR(100) NOT NULL,            -- 客人姓名
    room_number VARCHAR(10),                     -- 房号
    guest_phone VARCHAR(11),                     -- 客人电话尾号
    
    -- 状态管理
    status VARCHAR(20) DEFAULT '已接收',        -- 状态：已接收/已通知/已领取
    receive_time DATETIME DEFAULT CURRENT_TIMESTAMP, -- 接收时间
    pickup_time DATETIME,                        -- 领取时间
    
    -- 操作员信息
    received_by VARCHAR(50),                     -- 接收人员
    picked_up_by VARCHAR(50),                    -- 发放人员
    
    -- 存储位置
    storage_location VARCHAR(50),                -- 存放位置（前台/储物柜等）
    storage_number VARCHAR(20),                  -- 储物柜编号
    
    -- 备注信息
    notes TEXT,                                  -- 备注
    
    -- 系统字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    UNIQUE(tracking_number),
    INDEX idx_room_number(room_number),
    INDEX idx_status(status),
    INDEX idx_receive_time(receive_time),
    INDEX idx_guest_name(guest_name)
    );
  `)
})

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

export default app
