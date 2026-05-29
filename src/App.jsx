// === ส่วนที่ 1: การนำเข้าไลบรารีและเครื่องมือต่างๆ (Imports) ===
// ส่วนนี้คือการดึงความสามารถภายนอกมาใช้ในเว็บของเรา เช่น กราฟ, ไอคอน และตัวช่วยของ React
import './App.css'; // นำเข้าสไตล์การตกแต่งจากไฟล์ CSS
import webLogo from './img/Logo_umongcity_transparent.png';
import React, { useState, useEffect, useMemo } from 'react'; // นำเข้าหัวใจหลักของ React (State, Effect, Memo)
// นำเข้าส่วนประกอบของกราฟ (BarChart = กราฟแท่ง, PieChart = กราฟวงกลม)
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
// นำเข้าไอคอนต่างๆ จาก Lucide-React เพื่อใช้ในเมนูและปุ่ม (เช่น Dashboard, Users, Map)
import {
    LayoutDashboard, Users, Map as MapIcon, History, LogIn,
    Database, FileSpreadsheet, MapPin, Navigation, Info, AlertTriangle,
    Menu, X, ChevronRight, TrendingUp, Leaf, Wallet, PlusCircle, ChevronDown
} from 'lucide-react';
import { db } from './firebase'; // อันนี้ตัวเดียวพอ!
import {
    collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
    query, where, orderBy, limit, increment, serverTimestamp, startAfter
} from 'firebase/firestore';
import MapView from './MapView.jsx';



// === ส่วนที่ 2: องค์ประกอบย่อย (Sub-Components & Constants) ===
// ส่วนนี้คือการสร้าง "ชิ้นส่วนเล็กๆ" ไว้ข้างนอก เพื่อให้ตัว App หลักเรียกใช้ได้ง่ายและไม่รก




/**
 * NavItem: ปุ่มเมนูหลักในแถบ Sidebar
 * @param {boolean} active - สถานะว่าตอนนี้กำลังเปิดหน้านี้อยู่หรือไม่ (ถ้าใช่ จะขึ้นเส้นใต้สีน้ำเงิน)
 * @param {function} onClick - ฟังก์ชันที่จะทำงานเมื่อกดปุ่ม (เช่น เปลี่ยนหน้า)
 * @param {string} label - ชื่อของเมนูที่จะแสดง
 */
const NavItem = ({ active, onClick, label }) => (
    <button onClick={onClick}
        className={`text-sm font-semibold transition-colors ${active
            ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
            : 'text-slate-500 hover:text-blue-500'}`}>{label}
    </button>
);
// --- ปุ่มเมนูสำหรับแสดงผลบนมือถือ ---
// ใช้แสดงผลเมื่อเปิดเว็บผ่านโทรศัพท์ จะมีไอคอนและพื้นหลังสีฟ้าเวลาที่เลือกเมนูนั้นๆ
const MobileNavItem = ({ active, onClick, label, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${active
            ? 'bg-blue-50 text-blue-600 font-bold'
            : 'text-slate-600'
            }`}
    >
        {/* แสดงไอคอนและชื่อเมนูต่อกัน */}
        {icon} {label}
    </button>
);
/**
 * === DashboardView: หน้าจอภาพรวมสถิติ (หน้าแรก) ===
 * ส่วนนี้ทำหน้าที่ดึงข้อมูลสรุปมาแสดงผลเป็นกราฟและกล่องตัวเลข
 * @param {Array} stats - ข้อมูลสถิติ 5 กล่อง (ขยะรวม, คาร์บอน, ฯลฯ)
 * @param {Array} villageData - ข้อมูลอันดับของแต่ละหมวด
 * @param {Array} wasteTypeData - ข้อมูลน้ำหนักขยะแยกตามประเภทสำหรับกราฟแท่ง
 * @param {Array} members - ข้อมูลสมาชิกเพื่อนำมาคำนวณสัดส่วนการคัดแยก
 */
const DashboardView = ({ stats, villageData, wasteTypeData, members, setCurrentPage }) => {
    // 1. สัดส่วนการคัดแยกขยะ
    // ใช้ useMemo คำนวณสัดส่วนสมาชิกที่คัดแยกขยะแล้ว เทียบกับที่ยังไม่คัดแยก
    const separationStats = useMemo(() => {
        // ระบบป้องกัน: ถ้ายังไม่มีข้อมูลสมาชิก ให้ค่าเป็น 0 ทั้งหมดก่อน
        if (!members) return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: 0, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: 0, color: '#ef4444' }
        ];

        // กรองหาจำนวนบ้านที่ทำเครื่องหมายว่าคัดแยกแล้ว (isSorted)
        const sortedCount = members.filter(m => m.isSorted).length;
        const notSortedCount = members.length - sortedCount;

        return [
            { name: 'คัดแยกประเภทขยะแล้ว', value: sortedCount, color: '#16a34a' },
            { name: 'ยังไม่คัดแยกประเภทขยะ', value: notSortedCount, color: '#ef4444' }
        ];
    }, [members]);
    // 2. สัดส่วนการเข้าร่วมโครงการ (วงกลม 2)
    const participationStats = useMemo(() => {
        const participatedCount = members ? members.length : 0;
        const notParticipatedCount = 600; // ตั้งค่าเป้าหมายไว้ที่ 600 ก่อน
        return [
            { name: 'เข้าร่วมโครงการแล้ว', value: participatedCount, color: '#29c21bff' },
            { name: 'ยังไม่ได้เข้าร่วม', value: notParticipatedCount, color: '#8e978fff' }
        ];
    }, [members]);

    // 3. แนวโน้มการเติบโตของสมาชิก (ใช้ข้อมูลวันที่จริงจาก ID)
    const trendData = useMemo(() => {
        if (!members) return [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let beforeThisMonthCount = 0; // ยอดสะสมจนถึงเดือนที่แล้ว

        members.forEach(m => {
            // ระบบจะเอา ID ที่เป็นตัวเลข (Date.now()) มาแปลงกลับเป็นวันที่
            const joinDate = new Date(Number(m.id));

            // เช็คว่าถ้าไม่ใช่เดือนนี้และปีนี้ แปลว่าเป็นคนเก่าของเดือนก่อนๆ
            if (!isNaN(joinDate.getTime())) {
                if (joinDate.getMonth() !== currentMonth || joinDate.getFullYear() !== currentYear) {
                    beforeThisMonthCount++;
                }
            } else {
                // ถ้าดึงวันที่ไม่ได้ (เช่น ID แบบเก่าที่เป็นตัวหนังสือ) ให้เหมาว่าเป็นคนเก่าไว้ก่อน
                beforeThisMonthCount++;
            }
        });

        // เดือนก่อนหน้า = คนที่มีอยู่ก่อนเดือนนี้ทั้งหมด
        // เดือนนี้ = ยอดรวมทุกคนในระบบปัจจุบัน
        return [
            { name: 'เดือนก่อน', amount: beforeThisMonthCount, color: '#106e18ff' },
            { name: 'เดือนนี้', amount: members.length, color: '#19ac19ff' }
        ];
    }, [members]);

    return (
        <div className="space-y-6">
            {/* ส่วนที่ 1: การแสดงผลสถิติ 5 กล่องด้านบน (สรุปตัวเลขสำคัญ) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {stats && stats.length > 0 ? (
                    stats.map((stat, i) => (
                        <div key={i} className="modern-card flex flex-col gap-2 relative group cursor-default">
                            <div className="flex items-center justify-between">
                                <div className="p-3 bg-blue-50 rounded-2xl">{stat.icon}</div>
                                {stat.hasTooltip && <Info size={16} className="text-slate-300 cursor-help" />}
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-slate-500 mb-1">{stat.label}</p>
                                <p className="text-xl font-bold text-slate-800 tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    // ถ้าข้อมูลยังมาไม่ถึง ให้แสดงกล่องเปล่าๆ 5 กล่องไว้จองพื้นที่
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="modern-card h-[120px] animate-pulse bg-slate-50 border border-slate-100 flex flex-col justify-center items-center">
                            <div className="w-10 h-10 bg-slate-200 rounded-2xl mb-2"></div>
                            <div className="w-20 h-4 bg-slate-200 rounded-md"></div>
                        </div>
                    ))
                )}
            </div>

            {/* ── 🌟 ส่วนที่ 2: จัด Layout ใหม่ (ซ้าย 70% : ขวา 30%) ── */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* 📊 ฝั่งซ้าย (70%): กราฟวงกลม */}
                <div className="lg:w-[70%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
                        <h3 className="font-bold text-lg mb-6 text-slate-800 flex items-center gap-2">
                            <Leaf size={22} className="text-emerald-500" />
                            สัดส่วนสมาชิกที่คัดแยกประเภทขยะ (หมู่ 6)
                        </h3>

                        <div className="h-[350px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center border border-slate-100 mb-6">
                            {separationStats && separationStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={separationStats}
                                            innerRadius={90}
                                            outerRadius={130}
                                            paddingAngle={8}
                                            dataKey="value"
                                            label={({ name, value }) => `${name}: ${value} หลัง`}
                                        >
                                            {separationStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.name === 'ยังไม่คัดแยกประเภทขยะ' ? '#ef4444' : '#10b981'} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                        <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-slate-400 font-medium">กำลังโหลดข้อมูล...</p>
                            )}
                        </div>

                        {/* สรุปตัวเลขใต้กราฟวงกลม */}
                        <div className="grid grid-cols-2 gap-4 mt-auto">
                            <div className="p-4 bg-emerald-50/50 rounded-2xl text-center border border-emerald-100/50">
                                <p className="text-[13px] text-emerald-600 font-bold mb-1">คัดแยกแล้ว</p>
                                <p className="text-2xl font-black text-emerald-600">{separationStats[0].value} <span className="text-xs font-normal">หลัง</span></p>
                            </div>
                            <div className="p-4 bg-red-50/50 rounded-2xl text-center border border-red-100/50">
                                <p className="text-[13px] text-red-600 font-bold mb-1">ยังไม่คัดแยก</p>
                                <p className="text-2xl font-black text-red-600">{separationStats[1].value} <span className="text-xs font-normal">หลัง</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🏆 ฝั่งขวา (30%): อันดับหมวดสูงสุด (List Box) */}
                <div className="lg:w-[30%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                🏆 อันดับหมวดที่มีคาร์บอนเครดิตสูงสุด
                            </h3>
                        </div>

                        {/* List Box แนวตั้ง */}
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            {[...villageData]
                                .sort((a, b) => b.credit - a.credit)
                                .map((v, i) => (
                                    <div key={v.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:bg-emerald-50 hover:border-emerald-100 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            {/* เหรียญรางวัล */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0
                                                ${i === 0 ? 'bg-amber-100 text-amber-600 shadow-sm' :
                                                    i === 1 ? 'bg-slate-200 text-slate-500' :
                                                        i === 2 ? 'bg-orange-100 text-orange-600' :
                                                            'bg-white border text-slate-400'}`}>
                                                {i + 1}
                                            </div>

                                            {/* ชื่อหมู่บ้าน */}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-700 group-hover:text-emerald-700 transition-colors">{v.name}</span>
                                            </div>
                                        </div>

                                        {/* เครดิต (ชิดขวา) */}
                                        <div className="text-right flex flex-col items-end">
                                            <span className="font-black text-blue-600 group-hover:text-emerald-600 font-mono text-sm">{v.credit.toLocaleString()}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">แต้ม</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

            </div>
            {/* ── แถวที่ 3: กราฟเข้าร่วม (60%) + กราฟแท่งแนวนอนเปรียบเทียบ (40%) ── */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* กราฟเข้าร่วม 60% */}
                <div className="lg:w-[60%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[350px]">
                        <h3 className="font-bold text-lg mb-6 text-slate-800 flex items-center gap-2">
                            <Users size={22} className="text-blue-500" /> การเข้าร่วมธนาคารขยะ
                        </h3>
                        <div className="h-[250px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center border border-slate-50 mb-6 flex-grow">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={participationStats} innerRadius={65} outerRadius={95} paddingAngle={6} dataKey="value" label={({ value }) => `${value} หลัง`}>
                                        {participationStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                    <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '13px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* กราฟแนวนอนเปรียบเทียบ + ปุ่ม 40% */}
                <div className="lg:w-[40%] w-full">
                    <div className="modern-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[350px]">
                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                📈 แนวโน้มการเข้าร่วม
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">เปรียบเทียบยอดสมาชิกเดือนนี้และเดือนก่อนหน้า</p>
                        </div>

                        {/* กราฟแท่งแนวนอน (Horizontal Bar Chart) */}
                        <div className="h-[150px] w-full mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={trendData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 'bold' }} />
                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="amount" radius={[0, 8, 8, 0]} barSize={28} label={{ position: 'right', fill: '#475569', fontSize: 14, fontWeight: 'bold' }}>
                                        {trendData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* ปุ่ม Action กดทะลุไปหน้าข้อมูลสมาชิก */}
                        {/* ปุ่ม Action โทนสีเขียว กดแล้ววาร์ปไปด้านบนของหน้าข้อมูลสมาชิก */}
                        <div className="mt-auto">
                            <button
                                onClick={() => {
                                    if (typeof setCurrentPage !== 'undefined') {
                                        // 1. สั่งเปลี่ยนหน้าไปที่ข้อมูลสมาชิก
                                        setCurrentPage('villages');

                                        // 2. สั่งให้หน้าจอเด้งกลับไปบนสุดทันที (แบบสมูทๆ ไม่กระตุก)
                                        window.scrollTo({
                                            top: 0,
                                            behavior: 'smooth' // ถ้าอยากให้เด้งขึ้นไปทันทีแบบไม่ต้องเลื่อน ให้แก้คำว่า 'smooth' เป็น 'auto' ได้ครับ
                                        });
                                    }
                                }}
                                className="w-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors group shadow-sm"
                            >
                                <Users size={20} className="group-hover:scale-110 transition-transform" />
                                เปิดดูข้อมูลสมาชิกทั้งหมด
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ส่วนที่ 4: กราฟแท่ง (Bar Chart) แสดงปริมาณน้ำหนักขยะแยกตามประเภท */}
            <div className="modern-card">
                <h3 className="font-bold text-lg mb-4 text-slate-800">ปริมาณขยะแยกตามประเภท (กิโลกรัม)</h3>
                <div className="h-[300px] min-h-[300px] w-full bg-slate-50/50 rounded-2xl flex items-center justify-center">
                    {wasteTypeData && wasteTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={wasteTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="grad-plastic" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#86efac" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-paper" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#ffedd5" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-glass" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-aluminum" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#e9d5ff" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="grad-alloy" x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="0 0" vertical={false} stroke="#f1f5f9" opacity={0.4} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: window.innerWidth < 640 ? 9 : 11 }} // ปรับ font เล็กลงในมือถือ
                                    dy={10}
                                    interval={0} // บังคับให้โชว์ทุกอัน
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <RechartsTooltip cursor={{ fill: '#f8fafc', opacity: 0.4 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }} />

                                <Bar dataKey="amount" maxBarSize={40} radius={[6, 6, 0, 0]} >
                                    {wasteTypeData.map((entry, index) => {
                                        const colorGradients = [
                                            'url(#grad-plastic)', 'url(#grad-paper)', 'url(#grad-glass)', 'url(#grad-aluminum)', 'url(#grad-alloy)'
                                        ];
                                        return <Cell key={`cell-${index}`} fill={colorGradients[index % colorGradients.length]} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            กำลังโหลดข้อมูล...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const MemoizedDashboardView = React.memo(DashboardView);
// =========================================================================
// หน้าจอราคารับซื้อขยะ + เครื่องคำนวณเงินจำลองสำหรับผู้ใช้ทั่วไป
// =========================================================================
const PriceView = ({ isLoggedIn, isEditing, setIsEditing }) => {
    // ฐานข้อมูลราคารับซื้อตั้งต้น (5 ประเภทหลัก)
    const [prices, setPrices] = useState(() => {
        const savedPrices = localStorage.getItem('recycle_prices_data');
        return savedPrices ? JSON.parse(savedPrices) : [
            { id: 1, type: 'พลาสติก', price: 5.5, icon: '📦', color: 'bg-blue-50 text-blue-600' },
            { id: 2, type: 'กระดาษ', price: 4.0, icon: '📄', color: 'bg-amber-50 text-amber-600' },
            { id: 3, type: 'แก้ว', price: 1.5, icon: '🍾', color: 'bg-emerald-50 text-emerald-600' },
            { id: 4, type: 'อลูมิเนียม', price: 35.0, icon: '🥤', color: 'bg-purple-50 text-purple-600' },
            { id: 5, type: 'โลหะผสม', price: 8.0, icon: '⚙️', color: 'bg-rose-50 text-rose-600' },
        ];
    });

    // สเตตัสจำวันที่อัปเดตล่าสุด
    const [lastUpdated, setLastUpdated] = useState(() => {
        return localStorage.getItem('recycle_prices_updated_date') || 'ยังไม่มีการระบุวันที่';
    });

    const [tempPrices, setTempPrices] = useState({});

    // สเตตัสเก็บค่าน้ำหนักขยะ (กก.) ที่ประชาชนลองพิมพ์กรอกเล่นเพื่อคำนวณเงิน
    const [calcWeights, setCalcWeights] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '' });

    // ฟังก์ชันเปิดโหมดแอดมินแก้ไขราคา
    const handleStartEdit = () => {
        const currentTemp = {};
        prices.forEach(p => { currentTemp[p.id] = p.price; });
        setTempPrices(currentTemp);
        setIsEditing(true);
    };

    // ฟังก์ชันบันทึกราคาแอดมิน
    const handleSavePrices = () => {
        const updatedPrices = prices.map(p => ({ ...p, price: Number(tempPrices[p.id]) || 0 }));
        setPrices(updatedPrices);
        localStorage.setItem('recycle_prices_data', JSON.stringify(updatedPrices));

        const now = new Date();
        const ThaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        setLastUpdated(dateString);
        localStorage.setItem('recycle_prices_updated_date', dateString);
        setIsEditing(false);
        alert("💾 บันทึกการปรับเปลี่ยนราคารับซื้อประจำเดือนสำเร็จ!");
    };

    // คำนวณยอดเงินรวมทั้งหมดจากค่าน้ำหนักที่ผู้ใช้ทั่วไปกรอกคูณกับราคาปัจจุบัน
    const totalCalcMoney = useMemo(() => {
        return prices.reduce((sum, item) => {
            const weight = Number(calcWeights[item.id]) || 0;
            return sum + (weight * item.price);
        }, 0);
    }, [prices, calcWeights]);

    return (
        <div className="space-y-6">
            {/* ส่วนหัวเมนู (Header) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        💰 ตารางราคารับซื้อขยะรีไซเคิล
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium">
                        📊 ราคารับซื้อประจำเดือน (อัปเดตราคาเมื่อ: <span className="text-blue-600 font-bold">{lastUpdated}</span>)
                    </p>
                </div>

                {/* ปุ่มแอดมินแก้ไขราคา */}
                {isLoggedIn && (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 transition">ยกเลิก</button>
                                <button onClick={handleSavePrices} className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 shadow-md transition">✅ บันทึกราคา</button>
                            </>
                        ) : (
                            <button onClick={handleStartEdit} className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-md transition flex items-center gap-1">🔧 แก้ไขราคา</button>
                        )}
                    </div>
                )}
            </div>

            {/* บล็อกหลักแสดงราคารับซื้อแต่ละประเภท */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prices.map((item) => (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <span className={`text-2xl p-3 rounded-2xl ${item.color} font-bold`}>{item.icon}</span>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{item.type}</h4>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">ราคาต่อกิโลกรัม</p>
                            </div>
                        </div>

                        <div className="text-right">
                            {isEditing ? (
                                <div className="relative max-w-[100px]">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={tempPrices[item.id] ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTempPrices(prev => ({ ...prev, [item.id]: val === '' ? '' : Number(val) }));
                                        }}
                                        className="w-full border-2 border-blue-400 rounded-xl px-2 py-1.5 text-right font-black text-slate-800 outline-none text-base bg-blue-50/50"
                                    />
                                </div>
                            ) : (
                                <p className="text-xl font-black text-slate-800 font-mono">
                                    {item.price.toFixed(2)} <span className="text-xs font-bold text-slate-400">บาท</span>
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* เครื่องมือคำนวณยอดเงินจำลองสำหรับผู้ใช้ทั่วไป */}
            {!isEditing && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-inner space-y-4">
                    <div className="border-b border-slate-200 pb-3">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">🧮 เครื่องช่วยคำนวณเงินจำลอง</h3>
                        <p className="text-slate-400 text-xs mt-0.5">ลองใส่ปริมาณน้ำหนักขยะแต่ละประเภทด้านล่างเพื่อประเมินราคาที่ได้</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        {prices.map((item) => (
                            <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-between gap-2 shadow-sm">
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                    {item.icon} {item.type}
                                </span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={calcWeights[item.id]}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCalcWeights(prev => ({ ...prev, [item.id]: val }));
                                        }}
                                        className="w-full border-2 border-slate-100 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all text-right"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">กก.</span>
                                </div>
                                <div className="text-right text-[11px] text-slate-400 font-medium">
                                    เป็นเงิน: <span className="text-blue-500 font-bold font-mono">{((Number(calcWeights[item.id]) || 0) * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> บ.
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                            💵 รวมเงินที่คาดว่าจะได้รับทั้งหมด:
                        </div>
                        <div className="text-2xl font-black text-emerald-600 font-mono">
                            {totalCalcMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-emerald-500">บาท</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};




// =========================================================================
// ➕ [ขั้นตอนที่ 2: เพิ่มใหม่] คอมโพเนนต์หน้าต่างป๊อปอัพสำหรับแก้ไขข้อมูลสมาชิกและพิกัดหมุด (ระบบ Leaflet)
// =========================================================================
const EditMemberModal = ({ member, villageData, onSave, onDelete, onClose }) => {
    const [editData, setEditData] = useState({ ...member });
    const [showWaste, setShowWaste] = useState(false);

    // อัตราตัวคูณเครดิตสะสม (น้ำหนักขยะ 1 กิโลกรัม = 10 เครดิต) 
    const CREDIT_FACTOR = 10;

    // 📍 เรียกใช้งานแผนที่ย่อระบบ Leaflet ตัวเก่งของคุณ เพื่อให้แอดมินลากเลื่อนหมุดพิกัดบ้านได้
    useEffect(() => {
        const L = window.L;
        if (!L || !document.getElementById('edit-map-container')) return;

        // ดึงพิกัดเดิมของสมาชิกครัวเรือนรายนี้ขึ้นมาตั้งต้น
        const initLat = editData.lat || 18.5244;
        const initLng = editData.lng || 99.0435;

        // ส่องแผนที่ย่อ Leaflet ไปยังพิกัดเดิม
        const editMiniMap = L.map('edit-map-container').setView([initLat, initLng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(editMiniMap);

        // สร้างหมุดที่สามารถกดคลิกลากเพื่อย้ายตำแหน่งพิกัดได้ (draggable: true)
        const marker = L.marker([initLat, initLng], { draggable: true }).addTo(editMiniMap);
        marker.bindPopup("<b>🏠 ปรับพิกัดบ้านสมาชิก</b><br>สามารถลากหมุดไปวางตรงจุดใหม่ที่ถูกต้องได้").openPopup();

        // ดักจับเหตุการณ์เมื่อแอดมินลากหมุดเสร็จ ให้ดึงพิกัดจุดละติจูด/ลองจิจูดใหม่ไปอัปเดตลงสเตตัสเตรียมเซฟ
        marker.on('dragend', function (e) {
            const position = marker.getLatLng();
            setEditData(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
        });

        return () => editMiniMap.remove();
    }, []);

    // ฟังก์ชันสำหรับเพิ่มช่องกรอกรายชื่อคนในบ้านเพิ่ม (ตามเงื่อนไขเพิ่มสมาชิก)
    const handleAddFamilyMember = () => {
        setEditData(prev => ({
            ...prev,
            familyMembers: [...prev.familyMembers, '']
        }));
    };

    // ฟังก์ชันสำหรับลบช่องกรอกรายชื่อคนในบ้าน
    const handleRemoveFamilyMember = (index) => {
        setEditData(prev => {
            const nextList = prev.familyMembers.filter((_, i) => i !== index);
            return { ...prev, familyMembers: nextList.length === 0 ? [''] : nextList };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh] text-slate-700">

                {/* ส่วนหัวหน้าต่างบอกสถานะการทำงาน */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold">✏️ แก้ไขข้อมูลครัวเรือน</h3>
                        <p className="text-xs text-slate-400 mt-0.5">แก้ไขพิกัดหมุด รายชื่อสมาชิก หรือปริมาณขยะตั้งต้น</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">✕</button>
                </div>

                {/* ส่วนเนื้อหาฟอร์มการแก้ไขข้อมูล (เรียงตามลำดับความต้องการของคุณ) */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">

                    {/* 1. แก้ไขบ้านเลขที่ และเลือกแก้ไขหมวดหมู่ที่สมาชิกนั้นอยู่ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">🏠 บ้านเลขที่</label>
                            <input
                                type="text"
                                value={editData.houseNo}
                                onChange={(e) => setEditData({ ...editData, houseNo: e.target.value })}
                                className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">📂 สังกัดหมวดขยะประจำบ้าน</label>
                            <select
                                value={editData.villageId}
                                onChange={(e) => {
                                    const selectedId = Number(e.target.value);
                                    const selectedVillage = villageData.find(v => v.id === selectedId);
                                    setEditData({
                                        ...editData,
                                        villageId: selectedId,
                                        category: selectedVillage ? selectedVillage.name : 'ไม่ระบุหมวด'
                                    });
                                }}
                                className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold"
                            >
                                {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 2. แก้ไขการปักหมุดพิกัดบ้าน (หน้าต่างหมุดแก้ไขนี้จะสามารถเลื่อนไปปักเองได้) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">🗺️ แก้ไขจุดปักหมุดบ้าน (กดค้างที่ตัวหมุดแล้วลากย้ายตำแหน่งได้อิสระ)</label>
                        <div id="edit-map-container" className="h-48 w-full rounded-2xl border-2 border-slate-100 z-0 overflow-hidden relative"></div>
                        <p className="text-[11px] text-slate-400 font-mono">พิกัดปรับปรุง: {Number(editData.lat).toFixed(5)}, {Number(editData.lng).toFixed(5)}</p>
                    </div>

                    {/* 3. แก้ไขชื่อสมาชิกในบ้าน (เพิ่ม ลบ หรือแก้ไขชื่อคนในบ้านได้) */}
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700">👥 รายชื่อสมาชิกภายในครัวเรือน</label>
                            <button
                                type="button"
                                onClick={handleAddFamilyMember}
                                className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold border border-blue-100 hover:bg-blue-100 transition"
                            >
                                ➕ เพิ่มชื่อสมาชิกในบ้าน
                            </button>
                        </div>
                        <div className="space-y-2">
                            {editData.familyMembers.map((name, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <span className="text-xs font-bold text-slate-400 font-mono w-4">{index + 1}.</span>
                                    <input
                                        type="text"
                                        placeholder="ระบุชื่อ-นามสกุลสมาชิก"
                                        value={name}
                                        onChange={(e) => {
                                            const nextMembers = [...editData.familyMembers];
                                            nextMembers[index] = e.target.value;
                                            setEditData({ ...editData, familyMembers: nextMembers });
                                        }}
                                        className="flex-1 border-2 border-slate-100 p-2.5 rounded-xl outline-none bg-white font-medium text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFamilyMember(index)}
                                        className="text-red-500 hover:bg-red-50 p-2 rounded-xl text-xs transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. แก้ไขประเภทขยะของบ้านสมาชิกและน้ำหนักที่เคยกรอกพลาดไว้ได้ */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <button
                            type="button"
                            onClick={() => setShowWaste(!showWaste)}
                            className="w-full bg-slate-50 hover:bg-slate-100 p-3.5 text-xs font-black text-slate-600 flex justify-between items-center transition"
                        >
                            <span>📦 แก้ไขรายการน้ำหนักขยะสะสมตั้งต้น (กก.)</span>
                            <span>{showWaste ? '▲ ปิดแผง' : '▼ เปิดแผงแก้ไขน้ำหนัก'}</span>
                        </button>
                        {showWaste && (
                            <div className="p-4 bg-white grid grid-cols-2 gap-3 border-t border-slate-50">
                                {Object.keys(editData.wasteData || { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }).map((type) => (
                                    <div key={type} className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500">{type}</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={editData.wasteData[type] || 0}
                                            onChange={(e) => {
                                                const weight = Math.max(0, parseFloat(e.target.value) || 0);
                                                const nextWaste = { ...editData.wasteData, [type]: weight };
                                                // คำนวณแต้มเครดิตสะสมใหม่ของบ้านหลังนี้อัตโนมัติเมื่อแก้ตัวเลขกิโลกรัมขยะ (น้ำหนัก x 10)
                                                const nextCredit = Object.values(nextWaste).reduce((s, w) => s + (Number(w) * CREDIT_FACTOR), 0);
                                                setEditData({ ...editData, wasteData: nextWaste, credit: nextCredit });
                                            }}
                                            className="border-2 border-slate-100 p-2 rounded-xl outline-none bg-slate-50 font-bold text-sm text-right pr-4"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 5. สามารถแก้ไขเครดิตได้ (กล่องกรอกแก้ตัวเลขแต้มได้โดยตรง) */}
                    <div>
                        <label className="block text-sm font-bold mb-1 text-slate-700">🪙 แก้ไขแต้มเครดิตสะสมของบ้านหลังนี้ (ปรับแต่งตัวเลขโดยตรงได้)</label>
                        <input
                            type="number"
                            value={editData.credit || 0}
                            onChange={(e) => setEditData({ ...editData, credit: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-black text-blue-600 text-lg"
                        />
                    </div>

                    {/* 6. แก้ไขสถานะคัดแยกขยะ */}
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-dashed">
                        <span className="font-bold text-slate-700 text-sm">สถานะการคัดแยกประเภทขยะในครัวเรือน:</span>
                        <button
                            type="button"
                            onClick={() => setEditData({ ...editData, isSorted: !editData.isSorted })}
                            className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${editData.isSorted ? 'bg-green-500 text-white shadow-md' : 'bg-slate-300 text-slate-600'}`}
                        >
                            {editData.isSorted ? '✅ คัดแยกประเภทขยะแล้ว' : '⚪ ยังไม่คัดแยกประเภทขยะ'}
                        </button>
                    </div>

                </div>

                {/* ส่วนท้ายสุดล่างสุด: 7. ปุ่มลบสมาชิกเป็นรายคน (หรือลบทั้งบ้านหลังนี้ออก) และปุ่มยืนยัน */}
                <div className="p-6 bg-slate-50 border-t flex gap-3 justify-between items-center shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm(`⚠️ ยืนยันการลบข้อมูลบ้านเลขที่ ${editData.houseNo} ออกจากระบบอย่างถาวร?`)) {
                                onDelete(editData.id);
                            }
                        }}
                        className="px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-2xl transition border border-dashed border-red-200"
                    >
                        🗑️ ลบบ้านหลังนี้ออกจากระบบ
                    </button>
                    <div className="flex gap-2 flex-1 justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-3 font-bold text-slate-400 hover:text-slate-600 transition text-sm">ยกเลิก</button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!editData.houseNo) return alert("กรุณาระบุบ้านเลขที่");
                                onSave(editData);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition text-sm"
                        >
                            💾 บันทึกการแก้ไข
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};



const MembersView = ({ members, setMembers, villages, setVillages, isLoggedIn, logAdminAction }) => {
    const [expandedMemberId, setExpandedMemberId] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // 🔍 ตัวเก็บค่าที่พิมพ์ค้นหา

    // ฟังก์ชันโหลดข้อมูลสมาชิกแบบทีละหน้า
    const loadMembers = async (villageId, isReset = false) => {
        setLoadingMore(true);
        try {
            let q = query(
                collection(db, "members"),
                where("villageId", "==", Number(villageId)),
                orderBy("houseNo"),
                limit(20)
            );

            // ถ้าไม่ใช่การกดเริ่มใหม่ (Reset) ให้โหลดต่อจากคนสุดท้ายที่เคยโหลดไว้
            if (!isReset && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const snapshot = await getDocs(q);
            const newMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (isReset) {
                setMembers(newMembers);
            } else {
                setMembers(prev => [...prev, ...newMembers]);
            }

            // บันทึกเคอร์เซอร์คนล่าสุดไว้
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        } catch (err) {
            console.error("Error loading members:", err);
        }
        setLoadingMore(false);
    };
    // 🔄 [แก้ไขจุดที่ 1]: ดึงค่าหมวดที่แอดมินกดมาจากหน้าข้อมูลหมู่บ้านมาตั้งต้น ถ้าไม่มีให้ใช้หมวด 1
    const [selectedSortVillageId, setSelectedSortVillageId] = useState(() => {
        const savedZone = localStorage.getItem('active_sort_zone');
        return savedZone ? Number(savedZone) : 1;
    });

    // ➕ [เพิ่มใหม่]: ฟังก์ชันจดจำค่าเมื่อแอดมินเปลี่ยนตัวเลือกหมวดหมู่ที่ Dropdown ด้านบน
    const handleZoneChange = (zoneId) => {
        setSelectedSortVillageId(zoneId);
        localStorage.setItem('active_sort_zone', zoneId);
        loadMembers(zoneId, true); // โหลดหน้าแรกของหมวดใหม่
    };

    // ใช้ useEffect เพื่อโหลดครั้งแรก
    useEffect(() => {
        loadMembers(selectedSortVillageId, true);
    }, [selectedSortVillageId]);

    // 💾 ฟังก์ชันรับค่าเมื่อกดบันทึกความเปลี่ยนแปลงจากหน้าต่างแก้ไข
    const handleSaveEdit = async (updatedMember) => {
        const oldMember = members.find(m => m.id === updatedMember.id);
        const targetVillage = villages.find(v => v.id === updatedMember.villageId);
        if (targetVillage) {
            updatedMember.category = targetVillage.name;
        }

        // 1. อัปเดตรายชื่อและย้ายหมวดในสเตตัสทะเบียนสมาชิกหลัก
        const nextMembers = members.map(m => m.id === updatedMember.id ? updatedMember : m);
        setMembers(nextMembers);
        localStorage.setItem('local_members_data', JSON.stringify(nextMembers));

        // 2. หักลบน้ำหนักขยะออกจากหมวดเก่า และวิ่งไปบวกเพิ่มสะสมในหมวดใหม่
        setVillages(prevVillages => {
            const updatedVillages = prevVillages.map(v => {
                const nextWasteData = { ...v.wasteData };

                if (oldMember && v.id === oldMember.villageId) {
                    Object.keys(oldMember.wasteData || {}).forEach(type => {
                        nextWasteData[type] = Math.max(0, (Number(nextWasteData[type]) || 0) - (Number(oldMember.wasteData[type]) || 0));
                    });
                }

                if (v.id === updatedMember.villageId) {
                    Object.keys(updatedMember.wasteData || {}).forEach(type => {
                        nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(updatedMember.wasteData[type]) || 0);
                    });
                }

                return { ...v, wasteData: nextWasteData };
            });

            const finalVillages = updatedVillages.map(v => {
                const vMembers = nextMembers.filter(m => m.villageId === v.id);
                const memberCredits = vMembers.reduce((sum, m) => sum + (m.credit || 0), 0);
                const wasteCredits = v.wasteData ? Object.values(v.wasteData).reduce((a, b) => a + Number(b), 0) * 10 : 0;
                return { ...v, credit: memberCredits + wasteCredits };
            });

            localStorage.setItem('village_data', JSON.stringify(finalVillages));
            return finalVillages;
        });

        try {
            await setDoc(doc(db, "members", String(updatedMember.id)), updatedMember, { merge: true });
            setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
            // เก็บ alert ไว้ที่เดียวตอนเสร็จทุกอย่าง
            alert(`อัปเดตตำแหน่งบ้านและข้อมูลสำเร็จ! ${updatedMember.houseNo} ไปยัง ${updatedMember.category} และบันทึกลง Cloud สำเร็จ!`);
        } catch (err) {
            console.error("อัปเดต Firebase พลาด:", err);
            alert("❌ บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
        }

        setEditingMember(null);
    };

    // 🗑️ ฟังก์ชันลบข้อมูลบ้านสมาชิกออกจากระบบอย่างถาวร
    const handleDeleteMemberData = async (memberId) => {
        const targetMember = members.find(m => m.id === memberId);

        if (window.confirm("คุณแน่ใจใช่ไหมที่จะลบสมาชิกคนนี้? ข้อมูลทั้งหมดจะหายไปถาวร")) {
            try {
                // 1. ลบจาก Firebase
                await deleteDoc(doc(db, "members", String(memberId)));

                // 2. หักลบสถิติใน villages (แก้ตรงนี้ครับ!)
                if (targetMember) {
                    if (typeof logAdminAction === 'function') {
                        logAdminAction(`ได้ทำการลบข้อมูลครัวเรือน "บ้านเลขที่ ${targetMember.houseNo}" ออกจากฐานข้อมูลถาวร`);
                    }

                    setVillages(prevVillages => {
                        const updatedVillages = prevVillages.map(v => {
                            if (v.id === targetMember.villageId) {
                                const nextWasteData = { ...v.wasteData };

                                // หักน้ำหนักขยะออก
                                Object.keys(targetMember.wasteData || {}).forEach(type => {
                                    nextWasteData[type] = Math.max(0, (Number(nextWasteData[type]) || 0) - (Number(targetMember.wasteData[type]) || 0));
                                });

                                // ➕ สำคัญ: หักเครดิตออกจากยอดรวมหมวดด้วย!
                                const newCredit = Math.max(0, (Number(v.credit) || 0) - (Number(targetMember.credit) || 0));

                                return {
                                    ...v,
                                    wasteData: nextWasteData,
                                    credit: newCredit
                                };
                            }
                            return v;
                        });
                        localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                        return updatedVillages;
                    });
                }

                // 3. อัปเดต State สมาชิก
                const nextMembers = members.filter(m => m.id !== memberId);
                setMembers(nextMembers);
                localStorage.setItem('local_members_data', JSON.stringify(nextMembers));
                setEditingMember(null);

                alert("🗑️ ลบข้อมูลครัวเรือนและหักลบสถิติขยะออกจากระบบสำเร็จ");

            } catch (err) {
                console.error("ลบข้อมูลผิดพลาด:", err);
                alert("❌ เกิดข้อผิดพลาดในการลบข้อมูลจากระบบ");
            }
        }
    };

    const handleSaveWasteRecord = async (memberId, turnWasteData, turnCredit) => {
        let targetHouseNo = '';
        const updatedMembers = members.map(m => {
            if (String(m.id) === String(memberId)) {
                targetHouseNo = m.houseNo;
                const nextWasteData = { ...m.wasteData };
                Object.keys(turnWasteData).forEach(type => {
                    nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(turnWasteData[type]) || 0);
                });
                return { ...m, wasteData: nextWasteData, credit: (Number(m.credit) || 0) + Number(turnCredit), isSorted: true };
            }
            return m;
        });

        setMembers(updatedMembers);
        localStorage.setItem('local_members_data', JSON.stringify(updatedMembers));

        // ☁️ [เพิ่มตรงนี้]: อัปเดตข้อมูลขึ้น Cloud ตาม ID สมาชิก
        try {
            const updatedMember = updatedMembers.find(m => String(m.id) === String(memberId));
            await setDoc(doc(db, "members", String(memberId)), updatedMember);
        } catch (err) { console.error("Update Cloud Error:", err); }

        const targetMemberObj = members.find(m => String(m.id) === String(memberId));
        if (targetMemberObj) {
            setVillages(prevVillages => {
                const updatedVillages = prevVillages.map(v => {
                    if (v.id === targetMemberObj.villageId) {
                        const nextVillageWaste = { ...v.wasteData };
                        Object.keys(turnWasteData).forEach(type => {
                            nextVillageWaste[type] = (Number(nextVillageWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                        });
                        return { ...v, wasteData: nextVillageWaste, credit: (Number(v.credit) || 0) + Number(turnCredit) };
                    }
                    return v;
                });
                localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                return updatedVillages;
            });
        }

        const typesSummary = Object.entries(turnWasteData).filter(([_, w]) => w > 0).map(([t, w]) => `${t} ${w} กก.`).join(', ');
        logAdminAction(`บันทึกฝากขยะเพิ่มให้ "บ้านเลขที่ ${targetHouseNo}" สถิติ: [${typesSummary}] (+${turnCredit} แต้ม)`);
        setIsRecordWasteOpen(false);
        alert(`⚖️ บันทึกยอดขยะฝากเพิ่มสำเร็จ!`);
    };
    const displayedMembers = useMemo(() => {
        if (!members) return [];
        return members.filter(m => {
            const matchCategory = Number(m.villageId) === Number(selectedSortVillageId) ||
                String(m.villageId).trim() === String(selectedSortVillageId).trim();
            const matchSearch = String(m.houseNo).toLowerCase().includes(searchTerm.toLowerCase());
            return matchCategory && matchSearch;
        });
    }, [members, selectedSortVillageId, searchTerm]);

    return (
        <div className="space-y-6">
            {/* หัวข้อหน้าจอ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">🏠 บ้านสมาชิกในระบบ</h2>
                    <p className="text-slate-500 text-sm">รายชื่อครัวเรือนที่ลงทะเบียนในโครงการ (หมู่ 6)</p>
                </div>

                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center px-3">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                        type="text"
                        placeholder="ค้นหาบ้านเลขที่..."
                        className="text-xs font-bold outline-none w-full sm:w-32"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 🔍 แผง Dropdown เลือก Sort คัดกรองหมวดหมู่ */}
                {isLoggedIn && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-bold text-slate-500 pl-2">🔍 คัดกรองหมวด:</span>
                        <select
                            value={selectedSortVillageId}
                            onChange={(e) => handleZoneChange(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                        >
                            {villages.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ส่วนรายการการ์ดสมาชิก */}
            <div className="w-full space-y-4">
                {!displayedMembers || displayedMembers.length === 0 ? (
                    <div className="bg-white p-10 text-center text-slate-400 border border-slate-100 rounded-3xl shadow-sm italic text-sm">
                        {isLoggedIn
                            ? `ยังไม่มีข้อมูลสมาชิกครัวเรือนลงทะเบียนอยู่ในหมวดที่ ${selectedSortVillageId}`
                            : "ยังไม่มีข้อมูลสมาชิกในระบบ"
                        }
                    </div>
                ) : (
                    displayedMembers.map((member) => {
                        const isExpanded = expandedMemberId === member.id;
                        const credit = Number(member.credit) || 0;
                        const welfare = WELFARE_TIERS.find(t =>
                            credit >= t.min && (t.max === undefined || credit <= t.max)
                        );

                        return (
                            <div
                                key={member.id}
                                className="bg-white/90 backdrop-blur-md border border-sky-100/80 rounded-[28px] p-6 shadow-sm hover:shadow-xl hover:border-sky-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4"
                            >
                                {/* ชั้นที่ 1: ส่วนหัว */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <span className="bg-blue-50 text-blue-600 text-base font-black px-3 py-1.5 rounded-2xl border border-blue-100">
                                            🏠 บ้านเลขที่ {member.houseNo}
                                        </span>
                                        <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-xl">
                                            {member.category || 'ไม่ระบุหมวด'}
                                        </span>
                                        <span className="text-xs font-black px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl flex items-center gap-1 font-mono">
                                            🪙 {(member.credit || 0).toLocaleString()} แต้ม
                                        </span>
                                        <span className="text-[10px] font-bold px-3 py-1 bg-green-100 text-green-700 rounded-xl border border-green-200">
                                            🎁 สวัสดิการ: {welfare ? welfare.reward : "ยังไม่ถึงเกณฑ์"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 justify-end">
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${member.isSorted
                                            ? 'bg-green-100 text-green-600 border-green-200'
                                            : 'bg-slate-100 text-slate-400 border-slate-200'
                                            }`}>
                                            {member.isSorted ? '✅ คัดแยกประเภทขยะแล้ว' : '⚪ ยังไม่คัดแยกประเภทขยะ'}
                                        </span>

                                        {isLoggedIn && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingMember(member)}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border"
                                            >
                                                ⚙️ แก้ไขข้อมูล
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ชั้นที่ 2: รายการขยะ */}
                                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 mb-2.5">📦 ปริมาณน้ำหนักขยะประจำครัวเรือน</p>
                                    <div className="flex flex-wrap gap-2">
                                        {member.wasteData && Object.entries(member.wasteData).some(([_, w]) => Number(w) > 0) ? (
                                            Object.entries(member.wasteData).map(([type, weight]) => {
                                                if (Number(weight) <= 0) return null;
                                                return (
                                                    <div key={type} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5 shadow-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                        <span>{type}:</span>
                                                        <span className="text-blue-600 font-black">{Number(weight).toFixed(2)}</span>
                                                        <span className="text-[10px] text-slate-400">กก.</span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">ไม่มีข้อมูลการบันทึกขยะนำฝากตั้งต้น</p>
                                        )}
                                    </div>
                                </div>

                                {/* ชั้นที่ 3: รายชื่อสมาชิกแบบ Dropdown */}
                                <div className="w-full">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <span>👥 รายชื่อสมาชิกในบ้าน ({member.familyMembers ? member.familyMembers.filter(n => n && n.trim() !== '').length : 0} คน)</span>
                                        <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-2 p-4 bg-white border border-slate-100 rounded-2xl space-y-2 shadow-inner">
                                            {member.familyMembers && member.familyMembers.filter(n => n && n.trim() !== '').length > 0 ? (
                                                member.familyMembers.filter(n => n && n.trim() !== '').map((name, idx) => (
                                                    <div key={idx} className="pt-2 first:pt-0 text-xs font-bold text-slate-600 flex items-center gap-2 border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                                        <span className="text-slate-300 font-mono">{idx + 1}.</span>
                                                        <span>{name}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-400 italic text-center py-1">ไม่มีข้อมูลรายชื่อสมาชิกในระบบ</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>
                        );
                    })
                )}
                {members.length > 0 && (
                    <button
                        onClick={() => loadMembers(selectedSortVillageId, false)}
                        disabled={loadingMore}
                        className="w-full py-4 bg-white border-2 border-dashed border-blue-200 rounded-2xl font-bold text-blue-600 hover:bg-blue-50 transition"
                    >
                        {loadingMore ? "กำลังโหลด..." : "➕ ดูรายชื่อสมาชิกเพิ่มเติม"}
                    </button>
                )}
            </div>

            {/* แสดงเปิดหน้าต่างป๊อปอัพแก้ไขข้อมูลครัวเรือน */}
            {editingMember && (
                <EditMemberModal
                    member={editingMember}
                    villageData={villages}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteMemberData}
                    onClose={() => setEditingMember(null)}
                />
            )}
        </div>
    );
};
// === หน้าจอแสดงประวัติการทำรายการ (HistoryView) ===
// แสดงรายการบันทึกขยะและรายรับย้อนหลัง (ปัจจุบันเป็นข้อมูลจำลองเพื่อการแสดงผล UI)
const HistoryView = ({ members }) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-300 text-slate-700">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-50">
                <h2 className="font-bold text-xl text-blue-900 mb-4 flex items-center gap-2">
                    <History size={24} /> ทะเบียนสรุปแต้มเครดิตและน้ำหนักสะสมรายครัวเรือน
                </h2>

                <div className="space-y-3">
                    {members && members.length > 0 ? (
                        members.map((m, idx) => {
                            // คำนวณขยะสะสมรวมของบ้านหลังนี้
                            const totalHouseWaste = Object.values(m.wasteData || {}).reduce((a, b) => a + Number(b), 0);
                            return (
                                <div key={m.id || idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-800">🏠 บ้านเลขที่ {m.houseNo}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            สังกัด: {m.category || 'ไม่ระบุหมวด'} | ขยะสะสมรวม: <span className="font-bold text-blue-600">{totalHouseWaste.toFixed(2)}</span> กก.
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-emerald-600 font-bold font-mono">+{(m.credit || 0 * 10).toFixed(2)} บ.</p>
                                        <p className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full inline-block font-bold">
                                            🪙 {(m.credit || 0).toLocaleString()} แต้ม
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-8">ยังไม่มีข้อมูลประวัติครัวเรือนสมาชิกถูกบันทึกในระบบ</p>
                    )}
                </div>
            </div>
        </div>
    );
};
// === ➕ [เพิ่มใหม่]: หน้าจอแสดงผลประวัติงานเจ้าหน้าที่แบบแยกขาด (AdminLogsView) ===
const AdminLogsView = ({ adminLogs, setAdminLogs }) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-300 text-slate-700">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        📋 บันทึกประวัติกิจกรรมการทำงานของเจ้าหน้าที่ (Admin Action Logs)
                    </h2>
                    {adminLogs && adminLogs.length > 0 && (
                        <button
                            onClick={() => {
                                if (confirm("⚠️ คุณแน่ใจใช่ไหมที่จะล้างประวัติการทำงานของเจ้าหน้าที่ทั้งหมด?")) {
                                    localStorage.removeItem('admin_action_logs');
                                    setAdminLogs([]);
                                }
                            }}
                            className="text-[11px] text-red-500 font-bold hover:bg-red-50 px-2.5 py-1 rounded-lg border border-dashed border-red-200 transition"
                        >
                            🗑️ ล้างประวัติล็อก
                        </button>
                    )}
                </div>

                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                    {adminLogs && adminLogs.length > 0 ? (
                        adminLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl text-sm">
                                <div className="flex items-start gap-3">
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-lg text-xs mt-0.5 shrink-0">
                                        👤 {log.operator}
                                    </span>
                                    <p className="font-semibold text-slate-700">{log.action}</p>
                                </div>
                                <div className="text-right text-slate-400 text-xs font-medium shrink-0 pl-4 font-mono">
                                    <p>{log.time}</p>
                                    <p className="text-[10px] opacity-70">{log.date}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-8">ยังไม่มีบันทึกกิจกรรมการทำงานจากเจ้าหน้าที่ในระบบ</p>
                    )}
                </div>
            </div>
        </div>
    );
};
// === หน้าจอเข้าสู่ระบบสำหรับเจ้าหน้าที่ (LoginView) ===
// ทำหน้าที่ตรวจสอบ Username และ Password เพื่อให้สิทธิ์ในการเข้าถึงระบบจัดการ (Admin Panel)
const LoginView = ({ setIsLoggedIn, staffs, setCurrentUser, logAdminAction }) => {
    // ใช้ useState ภายในเพื่อเก็บค่าที่พิมพ์ในช่อง Input
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // ฟังก์ชันตรวจสอบการเข้าสู่ระบบ
    const handleLogin = () => {
        // วิ่งเช็กในข้อมูลเจ้าหน้าที่ (staffs) ที่ส่งมาจาก App ว่ามีอันที่ตรงกันไหม
        const foundStaff = staffs.find(s => s.username === username && s.password === password);

        if (foundStaff) {
            setIsLoggedIn(true); // อัปเดตสถานะใน App ให้เป็น "ล็อกอินแล้ว"
            setCurrentUser(foundStaff); // เก็บข้อมูลเจ้าหน้าที่ที่ล็อกอินอยู่
            setError('');
        } else {
            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); // แสดงข้อความเตือนเมื่อข้อมูลผิด
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-3xl shadow-xl border border-blue-100">
            {/* ส่วนหัวของฟอร์ม Login */}
            <div className="text-center mb-8">
                <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                    <LogIn size={32} />
                </div>
                <h2 className="font-bold text-2xl text-slate-800">สำหรับเจ้าหน้าที่</h2>
                <p className="text-slate-500 text-sm">เข้าสู่ระบบเพื่อจัดการข้อมูลเทศบาลตำบลอุโมงค์</p>
            </div>

            {/* ส่วนกรอกข้อมูล */}
            <div className="space-y-4">
                {/* แสดงข้อความ Error สีแดงเมื่อล็อกอินไม่สำเร็จ */}
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center font-medium">{error}</div>}

                <div>
                    <label className="block text-sm font-medium mb-1 text-slate-600">ชื่อผู้ใช้</label>
                    {/* 🔐 [เวอร์ชันล็อกปุ่ม]: สกัดกั้นการกด Spacebar ในช่องชื่อผู้ใช้ ป้องกันการพิมพ์เว้นวรรคเกินโดยไม่ตั้งใจ */}
                    <input
                        type="text"
                        className="w-full border rounded-xl px-4 py-3 bg-slate-50 focus:ring-2 ring-blue-100 outline-none transition"
                        placeholder="admin"
                        value={username}
                        onKeyDown={(e) => {
                            // บล็อกปุ่ม Spacebar (e.key === ' ' หรือเว้นวรรค) ไม่ให้ทำงานในช่องนี้
                            if (e.key === ' ') {
                                e.preventDefault();
                            }
                        }}
                        onChange={(e) => {
                            // ดักจับอีกชั้น: สั่งลบเว้นวรรคทิ้งทันทีหากมีการก๊อปปี้ข้อความที่มีเว้นวรรคมาวาง (Paste)
                            setUsername(e.target.value.replace(/\s/g, ''));
                        }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 text-slate-600">รหัสผ่าน</label>
                    {/* 🔐 [เวอร์ชันล็อกปุ่ม]: สกัดกั้นการกด Spacebar ในช่องรหัสผ่าน เพื่อป้องกันการพิมพ์วรรคเกินโดยไม่ตั้งใจ */}
                    <input
                        type="password"
                        className="w-full border rounded-xl px-4 py-3 bg-slate-50 focus:ring-2 ring-blue-100 outline-none transition"
                        placeholder="••••••••"
                        value={password}
                        onKeyDown={(e) => {
                            // บล็อกปุ่ม Spacebar ไม่ให้สามารถกดเว้นวรรคได้ในช่องรหัสผ่านนี้
                            if (e.key === ' ') {
                                e.preventDefault();
                            }
                        }}
                        onChange={(e) => {
                            // ดักจับอีกชั้น: สั่งลบเว้นวรรคทิ้งทันทีหากมีการก๊อปปี้รหัสผ่านที่มีเว้นวรรคติดมาวาง (Paste)
                            setPassword(e.target.value.replace(/\s/g, ''));
                        }}
                    />
                </div>

                {/* ปุ่มกดยืนยันการเข้าสู่ระบบ */}
                <button
                    onClick={handleLogin}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
                >
                    เข้าสู่ระบบ
                </button>
            </div>
        </div>
    );
};
// === แผงควบคุมหลักสำหรับเจ้าหน้าที่ (AdminPanel) ===
// ใช้แสดงเมนูจัดการต่าง ๆ เช่น การลงทะเบียนสมาชิก, บันทึกขยะ หรือดูประวัติ
const AdminPanel = ({
    currentUser, setCurrentPage, members, setMembers, editingVillage, setEditingVillage, onDeleteMember,
    isAddMemberOpen, setIsAddMemberOpen, currentLocation, setTempLocation, tempLocation, villageData,
    setIsPriceEditing, // ตัวรับสัญญาณแก้ไขราคาขยะลัด
    isRecordWasteOpen, setIsRecordWasteOpen, onSaveWasteRecord // ➕ เสียบปลั๊กเปิดรับตัวแปรบันทึกขยะเพิ่มสะสมรายวันตรงนี้ครับ!
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-lg">
                <h2 className="text-3xl font-bold mb-2">
                    สวัสดีครับ, {currentUser ? currentUser.name : 'เจ้าหน้าที่'} 👋
                </h2>
                <p className="opacity-80">ยินดีต้อนรับสู่ระบบจัดการข้อมูลธนาคารขยะเทศบาลตำบลอุโมงค์</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* ปุ่มลงทะเบียนสมาชิกใหม่ */}
                <button
                    onClick={() => {
                        if (typeof setTempLocation === 'function') {
                            setTempLocation(currentLocation);
                            setIsAddMemberOpen(true);
                        }
                    }}
                    className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all shadow-sm text-left group"
                >
                    <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <MapPin size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">ลงทะเบียนสมาชิกใหม่</h3>
                    <p className="text-sm text-slate-500">ปักหมุดบ้านและบันทึกข้อมูลสมาชิกใหม่ลงพื้นที่</p>
                </button>

                {/* 🔄 [ชุบชีวิตปุ่มบันทึกขยะจริง]: กดแล้วสั่งให้เปิดหน้าต่างกรอกน้ำหนักขยะสะสมทันที ไม่ขึ้น Alert หลอกแล้ว */}
                <button
                    onClick={() => setIsRecordWasteOpen(true)}
                    className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all shadow-sm text-left group"
                >
                    <div className="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <PlusCircle size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">บันทึกการทิ้งขยะ</h3>
                    <p className="text-sm text-slate-500">บันทึกประเภทและน้ำหนักขยะเพิ่มสะสมรวมลงรายครัวเรือน</p>
                </button>

                {/* ปุ่มจัดการสมาชิก */}
                <button onClick={() => setCurrentPage('members')} className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all shadow-sm text-left group">
                    <div className="bg-green-100 text-green-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <Users size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">จัดการรายชื่อสมาชิก</h3>
                    <p className="text-sm text-slate-500">เพิ่ม/ลบ หรือแก้ไขข้อมูลบ้านสมาชิก</p>
                </button>

                {/* ปุ่มแก้ไขราคาขยะลัด */}
                <button
                    onClick={() => {
                        setCurrentPage('prices');
                        if (typeof setIsPriceEditing === 'function') { setIsPriceEditing(true); }
                    }}
                    className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-amber-500 transition-all shadow-sm text-left group"
                >
                    <div className="bg-amber-100 text-amber-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <Database size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">แก้ไขราคารับซื้อขยะ</h3>
                    <p className="text-sm text-slate-500">ปรับเปลี่ยนมูลค่าราคากลางขยะ 5 ประเภทประจำเดือน</p>
                </button>

                {/* ปุ่มดูประวัติรายบ้าน */}
                <button onClick={() => setCurrentPage('history')} className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-purple-500 transition-all shadow-sm text-left group">
                    <div className="bg-purple-100 text-purple-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <History size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">สรุปยอดรายครัวเรือน</h3>
                    <p className="text-sm text-slate-500">ดูสถิติน้ำหนักขยะสะสมและแต้มรวมของสมาชิกแต่ละบ้าน</p>
                </button>

                {/* ปุ่มประวัติงานเจ้าหน้าที่ */}
                <button onClick={() => setCurrentPage('admin_logs')} className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-red-500 transition-all shadow-sm text-left group">
                    <div className="bg-red-100 text-red-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                        <FileSpreadsheet size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">ประวัติงานเจ้าหน้าที่</h3>
                    <p className="text-sm text-slate-500">ตรวจสอบบันทึก Log กิจกรรมการแก้ไขระบบเบื้องหลังของแอดมิน</p>
                </button>
            </div>

            {/* หน้าต่างลงทะเบียนสมาชิกอันเดิมของน้า */}
            {isAddMemberOpen && tempLocation && (
                <AddMemberModal
                    lat={tempLocation.lat}
                    lng={tempLocation.lng}
                    villageData={villageData}
                    onSave={async (newMem) => {
                        setMembers([...members, newMem]);
                        // ☁️ บรรทัดทองคำ: สั่งดันดาต้าขึ้นฐานข้อมูลคลาวด์สดๆ 
                        await setDoc(doc(db, "members", String(newMem.id)), newMem);
                        setIsAddMemberOpen(false);
                        alert("📍 บันทึกข้อมูลสมาชิกสำเร็จ!");
                    }}
                    onClose={() => setIsAddMemberOpen(false)}
                />
            )}

            {/* ➕ [หน้าต่างเด้งเพิ่มใหม่]: หน้าต่างบันทึกขยะนำฝากเพิ่มรายวัน */}
            {isRecordWasteOpen && (
                <RecordWasteModal
                    members={members}
                    onClose={() => setIsRecordWasteOpen(false)}
                    onSave={onSaveWasteRecord}
                />
            )}
        </div>
    );
};

// === หน้าต่างแสดงรายละเอียดเชิงลึกของแต่ละหมวด (VillageDetailsModal) ===
// ใช้แสดงตัวเลขน้ำหนักขยะแยกประเภท และคะแนนเครดิตสะสมของแต่ละหมวด
const VillageDetailsModal = ({ village, onClose, villages, members }) => {
    if (!village) return null;

    const latestVillage = villages?.find(v => Number(v.id) === Number(village?.id)) || village;


    // 🔄 [แก้ไขจุดคัดกรอง]: บังคับกรองด้วย ID ตัวเลขเท่านั้น เพื่อความแม่นยำสูงสุด ไม่ให้ดึงข้ามหมวด
    const villageMembers = members
        ? members.filter(m => Number(m.villageId) === Number(latestVillage.id))
        : [];

    const aggregatedWaste = villageMembers.reduce((acc, m) => {
        const data = m.wasteData || {};
        Object.keys(data).forEach(type => {
            acc[type] = (acc[type] || 0) + Number(data[type] || 0);
        });
        return acc;
    }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });

    // 🔧 [สูตรคำนวณแยกหมวดเด็ดขาด] (ของน้าอันเดิมก็ดีอยู่แล้วครับ)
    const correctVillageTotalCredit = villageMembers.reduce((sum, m) => sum + (Number(m.credit) || 0), 0);
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-700">

                {/* ส่วนหัว (Header) สีน้ำเงิน พร้อมชื่อหมวด */}
                <div className="p-6 border-b bg-blue-600 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl">🏠 {latestVillage.name}</h3>
                        <p className="text-xs opacity-90 mt-1">จำนวนครัวเรือนในหมวดนี้: {villageMembers.length} หลังคาเรือน</p>
                    </div>
                    {/* ปุ่มปิดหน้าต่าง (กากบาท) */}
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
                        <X size={24} />
                    </button>
                </div>

                {/* ส่วนเนื้อหาหลัก: แสดงน้ำหนักขยะแยก 5 ประเภท */}
                <div className="p-8">
                    <h4 className="font-bold text-slate-800 mb-6">📊 รายละเอียดประเภทขยะ</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map(type => (
                            <div key={type} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{type}</p>
                                <div className="flex flex-col items-center">
                                    <span className="text-xl font-black text-blue-600">
                                        {Number(aggregatedWaste[type] || 0).toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">กก.</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 📋 ส่วนที่แสดงรายชื่อบ้านภายในหมวดนั้นๆ */}
                    <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-bold text-slate-500 mb-3">📋 บัญชีรายชื่อบ้านภายในหมวด</h4>
                        <div className="max-h-40 overflow-y-auto space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            {villageMembers.length > 0 ? (
                                villageMembers.map((m, idx) => (
                                    <div key={m.id} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                        <span>{idx + 1}. บ้านเลขที่ {m.houseNo}</span>
                                        <span className="text-amber-500 font-mono">🪙 {(m.credit || 0).toLocaleString()} แต้ม</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-4">ยังไม่มีสมาชิกขึ้นทะเบียนในหมวดนี้</p>
                            )}
                        </div>
                    </div>

                    {/* กล่องสรุปเครดิตสะสมด้านล่าง */}
                    <div className="mt-6 bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                        <span className="font-bold text-blue-800 text-sm">เครดิตสะสมรวมทั้งหมวด :</span>
                        <span className="text-xl font-black text-blue-600 font-mono">
                            {/* ✨ นับแต้มผลรวมของคนข้างในหมวดมาโชว์ตรง ๆ ตัดขาดจากระบบแต้มส่วนกลาง */}
                            {villageMembers.reduce((sum, m) => sum + (Number(m.credit) || 0), 0).toLocaleString()} 🪙
                        </span>
                    </div>
                </div>

                {/* ส่วนท้าย (Footer): ปุ่มปิดหน้าต่างแบบใหญ่ */}
                <div className="p-6 bg-slate-50 border-t text-center">
                    <button onClick={onClose} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition shadow-sm">
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
};
// === หน้าจอรายการหมวดทั้ง 9 (VillagesView) ===
// แสดงการ์ดสรุปข้อมูลของแต่ละหมวด เช่น น้ำหนักขยะรวม, ค่าการลดคาร์บอน และเครดิต
const VillagesView = ({ villageData, setSelectedVillage, setCurrentPage, isLoggedIn, setEditingVillage }) => {
    // สูตรคำนวณคาร์บอน (Factor อ้างอิงจาก อบก.)
    const calculateCarbon = (wasteData) => {
        const FACTORS = {
            'พลาสติก': 1.03,
            'กระดาษ': 0.85,
            'แก้ว': 0.25,
            'อลูมิเนียม': 9.13,
            'โลหะผสม': 1.21
        };
        return Object.entries(wasteData || {}).reduce((total, [type, weight]) => {
            return total + (Number(weight) * (FACTORS[type] || 0));
        }, 0);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
            {villageData.map((v) => {
                const totalWaste = v.wasteData ? Object.values(v.wasteData).reduce((a, b) => a + Number(b), 0) : 0;
                const carbonReduced = calculateCarbon(v.wasteData);

                return (
                    <div key={v.id} className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all group shadow-sm flex flex-col relative overflow-hidden">
                        {/* แถบสีข้างหมวด */}
                        <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-2xl text-blue-900">{v.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest"> หมู่ 6 ต.อุโมงค์</p>
                            </div>
                            <div className="bg-emerald-50 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-black flex items-center gap-1 border border-emerald-100">
                                <Leaf size={10} /> ECO ACTIVE
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-slate-600 mb-6 flex-grow">
                            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                <span className="text-xs font-bold text-slate-500">น้ำหนักขยะรวม:</span>
                                <span className="font-black text-blue-600 text-lg">
                                    {v.totalWaste.toLocaleString()} <small className="text-[10px] text-slate-400">กก.</small>
                                </span>
                            </div>

                            <div className="flex justify-between items-center px-2">
                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                    <Leaf size={14} className="text-emerald-500" /> ลดคาร์บอนได้:
                                </span>
                                <span className="font-bold text-emerald-600">
                                    {carbonReduced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <small className="text-[10px] ml-1">kgCO2e</small>
                                </span>
                            </div>

                            <div className="flex justify-between items-center px-2 border-t border-dashed pt-2">
                                <span className="text-xs font-bold text-slate-500">เครดิตหมวด:</span>
                                <span className="font-bold text-amber-500">
                                    {/* ✨ ดึงแต้มรวมจากโครงสร้าง v.credit โดยตรงเพื่อตัดปัญหา ReferenceError แจ้งตัวแปรไม่นิยาม */}
                                    {Math.max(0, v.credit).toLocaleString()} 🪙
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {isLoggedIn && (
                                <button
                                    onClick={() => setEditingVillage(v)}
                                    className="w-full bg-blue-600 text-white py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100"
                                >
                                    <FileSpreadsheet size={18} /> บันทึกข้อมูลหมวด
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        localStorage.setItem('active_sort_zone', v.id); // สั่งจำไอดีหมวดที่คลิกเลือก
                                        setCurrentPage('members'); // ดีดหน้าจอไปคลังรายชื่อสมาชิก
                                    }}
                                    className="py-3 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition font-bold text-xs"
                                >
                                    <Users size={16} /> สมาชิก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedVillage(v);

                                    }}
                                    className="py-3 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition font-bold text-xs"
                                >
                                    <TrendingUp size={16} /> สถิติ
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
// คำนวณสวัสดิการรายบ้าน
const WELFARE_TIERS = [
    { min: 0, max: 100, reward: "ยังไม่ได้รับสวัสดิการ" },
    { min: 101, max: 500, reward: "คูปองส่วนลดร้านค้าชุมชน" },
    { min: 501, max: 1000, reward: "ส่วนลดค่าธรรมเนียมขยะรายปี" },
    { min: 1001, reward: "สิทธิ์เบิกค่ารักษาพยาบาลฉุกเฉิน" }
];
// === หน้าต่างแก้ไขข้อมูลหมวด (EditVillageModal) ===
// ใช้สำหรับแอดมินในการแก้ไขชื่อหมวด บันทึกน้ำหนักขยะ และลบสมาชิกในหมวด
const EditVillageModal = ({ village, onClose, onSave, members, onDeleteMember }) => {
    const [editName, setEditName] = useState(village.name);
    const [wasteWeights, setWasteWeights] = useState({
        'พลาสติก': village.wasteData?.['พลาสติก'] || 0,
        'กระดาษ': village.wasteData?.['กระดาษ'] || 0,
        'แก้ว': village.wasteData?.['แก้ว'] || 0,
        'อลูมิเนียม': village.wasteData?.['อลูมิเนียม'] || 0,
        'โลหะผสม': village.wasteData?.['โลหะผสม'] || 0
    });

    // 🔄 [แก้ไขจุดคัดกรอง]: ล็อกให้ดึงเฉพาะสมาชิกที่อยู่ในหมวดนี้เท่านั้นมาแสดง (เทียบละเอียดทุกรูปแบบ ป้องกันข้อมูลปนกันมั่ว)
    const villageMembers = members
        ? members.filter(m => m.category === village.name || m.category === editName)
        : [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <div className="flex-grow mr-4">
                        <label className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1 block">แก้ไขชื่อหมู่บ้าน/ชุมชน</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-slate-800 text-xl font-bold focus:border-blue-400 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow text-slate-700">
                    {/* ส่วนที่ 1: ขยะ */}
                    <div>
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Database size={18} className="text-blue-500" /> ข้อมูลขยะแยกประเภท
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map((type) => (
                                <div key={type} className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        📦 {type}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={wasteWeights[type] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setWasteWeights(prev => ({
                                                    ...prev,
                                                    [type]: val === '' ? 0 : Number(val)
                                                }));
                                            }}
                                            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-blue-400 outline-none transition-all font-bold text-lg"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                            กก.
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ส่วนที่ 2: รายชื่อสมาชิกประจำหมวด */}
                    <div className="space-y-2">
                        {villageMembers.map(m => {
                            // 1. เปลี่ยนจาก ( เป็น { เพื่อเปิดบล็อกคำสั่ง
                            // 2. แทรก Logic คำนวณตรงนี้
                            const credit = Number(m.credit) || 0;
                            const welfare = WELFARE_TIERS.find(t =>
                                credit >= t.min && (t.max === undefined || credit <= t.max)
                            );

                            // 3. ต้องมีคำสั่ง return ตามมาครับ
                            return (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">🏠 บ้านเลขที่ {m.houseNo}</p>
                                        <p className="text-[10px] text-slate-500">ID: {m.id} | เครดิต: {credit.toLocaleString()} 🪙</p>
                                    </div>

                                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">
                                        {welfare ? welfare.reward : "ไม่มีข้อมูล"}
                                    </div>

                                    <button
                                        onClick={() => onDeleteMember(m.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })} {/* 4. ปิดด้วยวงเล็บปีกกาและวงเล็บปิดของ map */}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 transition">
                        ปิดหน้าต่าง
                    </button>
                    <button
                        onClick={() => {
                            const finalWasteData = {
                                'พลาสติก': Number(wasteWeights?.['พลาสติก'] || 0),
                                'กระดาษ': Number(wasteWeights?.['กระดาษ'] || 0),
                                'แก้ว': Number(wasteWeights?.['แก้ว'] || 0),
                                'อลูมิเนียม': Number(wasteWeights?.['อลูมิเนียม'] || 0),
                                'โลหะผสม': Number(wasteWeights?.['โลหะผสม'] || 0)
                            };

                            const totalCredit = Object.values(finalWasteData).reduce((sum, weight) => sum + (weight * 10), 0);

                            const updatedData = {
                                ...village,
                                name: editName,
                                wasteData: finalWasteData,
                                credit: totalCredit
                            };

                            onSave(updatedData);
                            onClose();
                        }}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition"
                    >
                        บันทึกข้อมูลหลัก
                    </button>
                </div>
            </div>
        </div>
    );
};
const AddMemberModal = ({ initialLat, initialLng, villageData, onSave, onClose }) => {
    // 1. สร้าง State สำหรับเก็บข้อมูลสมาชิกใหม่
    const [newMember, setNewMember] = useState({
        id: Date.now(),
        houseNo: '',
        villageId: villageData[0]?.id || 1,
        category: villageData[0]?.name || 'หมวดที่ 1',
        familyMembers: [''], // เก็บรายชื่อสมาชิกทุกคนในบ้าน
        isSorted: false,     // สถานะการคัดแยก 
        lat: initialLat,
        lng: initialLng,
        credit: 0,
        wasteData: { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 }
    });

    // 2. สเตตัสสำหรับเปิด-ปิดการติ๊กเลือกประเภทขยะตั้งต้น (Checkbox)
    const [selectedWastes, setSelectedWastes] = React.useState({
        'พลาสติก': false, 'กระดาษ': false, 'แก้ว': false, 'อลูมิเนียม': false, 'โลหะผสม': false
    });

    // 3. อัตราตัวคูณเครดิตสะสม (น้ำหนักขยะ 1 กิโลกรัม = 10 เครดิต)
    const CREDIT_FACTOR = 10;

    const addMemberField = () => {
        setNewMember({ ...newMember, familyMembers: [...newMember.familyMembers, ''] });
    };

    const updateMemberName = (index, value) => {
        const updatedFamily = [...newMember.familyMembers];
        updatedFamily[index] = value;
        setNewMember({ ...newMember, familyMembers: updatedFamily });
    };

    const removeMemberField = (index) => {
        const updatedFamily = newMember.familyMembers.filter((_, i) => i !== index);
        setNewMember({ ...newMember, familyMembers: updatedFamily });
    };

    // แผนที่ย่อ (Mini Map) ปักหมุดลากเลื่อนได้
    React.useEffect(() => {
        const L = window.L;
        if (!L) return;

        const miniMap = L.map('mini-map-container').setView([newMember.lat, newMember.lng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(miniMap);

        const marker = L.marker([newMember.lat, newMember.lng], { draggable: true }).addTo(miniMap);
        marker.bindPopup("<b>🏠 ตำแหน่งบ้านสมาชิก</b><br>สามารถลากหมุดเพื่อปรับพิกัดให้ตรงกับตัวบ้านได้").openPopup();

        marker.on('dragend', function (e) {
            const position = marker.getLatLng();
            setNewMember(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
        });

        window.findMiniLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    miniMap.setView([latitude, longitude], 17);
                    marker.setLatLng([latitude, longitude]);
                    setNewMember(prev => ({ ...prev, lat: latitude, lng: longitude }));
                });
            }
        };

        return () => miniMap.remove();
    }, [initialLat, initialLng]);

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
                <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                    <h3 className="font-bold text-xl flex items-center gap-2">📍 ลงทะเบียนสมาชิกพร้อมปักหมุดพิกัด</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-grow text-slate-700">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-slate-700">🗺️ แผนที่พิกัดบ้าน (ลากหมุดเพื่อปรับความแม่นยำได้)</label>
                            <button type="button" onClick={() => window.findMiniLocation && window.findMiniLocation()} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1 shadow-sm">
                                <Navigation size={12} /> ค้นหาตัวฉัน
                            </button>
                        </div>
                        <div id="mini-map-container" className="h-48 w-full rounded-2xl border-2 border-slate-100 z-0 overflow-hidden"></div>
                        <p className="text-[11px] text-slate-400 font-mono">พิกัดปัจจุบัน: {newMember.lat.toFixed(5)}, {newMember.lng.toFixed(5)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">บ้านเลขที่</label>
                            <input type="text" className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold" value={newMember.houseNo} onChange={e => setNewMember({ ...newMember, houseNo: e.target.value })} placeholder="เช่น 123/4" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-slate-700">หมวดที่รับผิดชอบ</label>
                            <select className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold" value={newMember.villageId} onChange={e => {
                                const selectedId = parseInt(e.target.value);
                                const v = villageData.find(item => item.id === selectedId);
                                if (v) setNewMember({ ...newMember, villageId: v.id, category: v.name });
                            }}>
                                {villageData.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700">รายชื่อสมาชิกในบ้านทุกคน</label>
                        <div className="space-y-2">
                            {newMember.familyMembers.map((name, index) => (
                                <div key={index} className="flex gap-2">
                                    <input type="text" className="flex-1 border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50" placeholder={`คนที่ ${index + 1}`} value={name} onChange={(e) => updateMemberName(index, e.target.value)} />
                                    {newMember.familyMembers.length > 1 && <button type="button" onClick={() => removeMemberField(index)} className="p-2 text-red-400"><X size={16} /></button>}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addMemberField} className="mt-3 w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-bold hover:bg-blue-50 flex items-center justify-center gap-2">
                            <PlusCircle size={18} /> เพิ่มชื่อสมาชิก
                        </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold mb-3 text-slate-700">📦 ขยะนำฝากตั้งต้น (ติ๊กเลือกประเภทเพื่อบันทึกปริมาณเข้าสู่ระบบ)</label>
                        <div className="space-y-3">
                            {Object.keys(newMember.wasteData).map(type => (
                                <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border rounded-2xl gap-2">
                                    <label className="flex items-center gap-3 font-bold text-slate-700 cursor-pointer select-none">
                                        <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={selectedWastes[type]} onChange={e => setSelectedWastes({ ...selectedWastes, [type]: e.target.checked })} />
                                        <span>{type}</span>
                                    </label>
                                    {selectedWastes[type] && (
                                        <div className="relative flex items-center">
                                            <input type="number" step="any" placeholder="0.00" className="border-2 border-slate-200 px-4 py-1.5 rounded-xl outline-none w-32 text-right font-bold pr-10 focus:border-blue-500 bg-white" onChange={e => {
                                                const weight = Math.max(0, parseFloat(e.target.value) || 0);
                                                setNewMember(prev => {
                                                    const updatedWaste = { ...prev.wasteData, [type]: weight };
                                                    const totalCredit = Object.values(updatedWaste).reduce((sum, w) => sum + (w * CREDIT_FACTOR), 0);
                                                    return { ...prev, wasteData: updatedWaste, credit: totalCredit };
                                                });
                                            }} />
                                            <span className="absolute right-3 text-xs text-slate-400 font-bold">กก.</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-dashed">
                        <span className="font-bold text-slate-700 text-sm">สถานะการคัดแยกประเภทขยะ:</span>
                        <button type="button" onClick={() => setNewMember({ ...newMember, isSorted: !newMember.isSorted })} className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${newMember.isSorted ? 'bg-green-500 text-white shadow-md' : 'bg-slate-300 text-slate-600'}`}>
                            {newMember.isSorted ? '✅ คัดแยกประเภทขยะแล้ว' : '⚪ ยังไม่คัดแยกประเภทขยะ'}
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition">ยกเลิก</button>
                    <button type="button" onClick={() => {
                        if (!newMember.houseNo || newMember.familyMembers[0] === '') return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
                        onSave(newMember);
                    }} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition">
                        บันทึกข้อมูลสมาชิก
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// ➕ [คอมโพเนนต์เพิ่มใหม่]: หน้าต่างบันทึกการทิ้งขยะประจำวัน (RecordWasteModal)
// =========================================================================
const RecordWasteModal = ({ members, onSave, onClose }) => {
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [wasteInputs, setWasteInputs] = useState({
        'พลาสติก': '',
        'กระดาษ': '',
        'แก้ว': '',
        'อลูมิเนียม': '',
        'โลหะผสม': ''
    });

    const CREDIT_FACTOR = 10;

    // คำนวณแต้มที่จะได้รับเพิ่มในรอบนี้แบบเรียลไทม์
    const currentTurnCredit = useMemo(() => {
        return Object.values(wasteInputs).reduce((sum, w) => sum + (Number(w) * CREDIT_FACTOR), 0);
    }, [wasteInputs]);

    return (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh] text-slate-700">
                {/* ส่วนหัว Header */}
                <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl flex items-center gap-2">⚖️ บันทึกน้ำหนักขยะนำฝากเพิ่ม</h3>
                        <p className="text-xs text-emerald-100 mt-0.5">เลือกบ้านเลขที่และกรอกน้ำหนักขยะเพื่อคำนวณสะสมแต้ม</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-white text-lg">✕</button>
                </div>

                {/* ส่วนฟอร์มกรอกข้อมูล */}
                <div className="p-6 space-y-5 overflow-y-auto flex-grow">
                    {/* 1. เลือกบ้านเลขที่สมาชิก */}
                    <div>
                        <label className="block text-sm font-bold mb-1.5 text-slate-700">🏠 เลือกครัวเรือนสมาชิก (หมู่ 6)</label>
                        <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-slate-50 font-bold text-slate-700"
                        >
                            <option value="">-- กรุณาเลือกบ้านเลขที่สมาชิก --</option>
                            {members && members.map(m => (
                                <option key={m.id} value={m.id}>
                                    บ้านเลขที่ {m.houseNo} ({m.category || 'ไม่ระบุหมวด'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. กรอกน้ำหนักแยกประเภทขยะ 5 ชนิด */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <label className="block text-sm font-bold text-slate-700">📦 ปริมาณน้ำหนักขยะที่นำมาฝากรอบนี้ (กิโลกรัม)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'].map((type) => (
                                <div key={type} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border">
                                    <label className="text-xs font-bold text-slate-500">{type}</label>
                                    <div className="relative flex items-center">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="0.00"
                                            value={wasteInputs[type]}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setWasteInputs(prev => ({ ...prev, [type]: val }));
                                            }}
                                            className="w-full border-b-2 border-slate-100 focus:border-emerald-500 outline-none text-right font-black text-slate-800 pr-8 py-1"
                                        />
                                        <span className="absolute right-1 text-xs text-slate-400 font-bold">กก.</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. กล่องโชว์แต้มที่จะได้รับรอบนี้ */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                        <span className="font-bold text-emerald-800 text-sm">🪙 แต้มเครดิตที่จะได้รับเพิ่มในรอบนี้:</span>
                        <span className="text-xl font-black text-emerald-600 font-mono">
                            +{currentTurnCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} แต้ม
                        </span>
                    </div>
                </div>

                {/* ปุ่มควบคุมล่างสุด */}
                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 transition">ยกเลิก</button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!selectedMemberId) return alert("❌ กรุณาเลือกบ้านเลขที่สมาชิกก่อนบันทึกครับ");

                            const hasValues = Object.values(wasteInputs).some(v => Number(v) > 0);
                            if (!hasValues) return alert("❌ กรุณากรอกน้ำหนักขยะอย่างน้อย 1 ประเภทครับ");

                            const finalTurnWaste = {
                                'พลาสติก': Number(wasteInputs['พลาสติก']) || 0,
                                'กระดาษ': Number(wasteInputs['กระดาษ']) || 0,
                                'แก้ว': Number(wasteInputs['แก้ว']) || 0,
                                'อลูมิเนียม': Number(wasteInputs['อลูมิเนียม']) || 0,
                                'โลหะผสม': Number(wasteInputs['โลหะผสม']) || 0
                            };

                            onSave(selectedMemberId, finalTurnWaste, currentTurnCredit);
                        }}
                        className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition"
                    >
                        💾 ยืนยันบันทึกยอดขยะสะสม
                    </button>
                </div>
            </div>
        </div>
    );
};
const App = () => {
    // --- DATABASE: ส่วนเก็บข้อมูลหลักของแอปพลิเคชัน ---
    useEffect(() => {
        const now = new Date();
        const todayKey = `visit_date_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
        const monthKey = `visit_month_${now.getFullYear()}_${now.getMonth()}`;
        const totalKey = `visit_total_counter`;

        // 1. ดึงข้อมูลเก่าที่เคยนับค้างไว้ในเครื่องขึ้นมาตรวจ
        let currentToday = Number(localStorage.getItem(todayKey)) || 0;
        let currentMonth = Number(localStorage.getItem(monthKey)) || 0;
        let currentTotal = Number(localStorage.getItem(totalKey)) || 0;

        // 2. เช็กว่าสิทธิ์การเข้าชมรอบนี้ (Session) ถูกนับไปหรือยังในหน้านี้ เพื่อป้องกันตัวเลขดีดรัวๆ ตอนกดสลับเมนู
        const hasCountedInSession = sessionStorage.getItem('page_view_counted');

        if (!hasCountedInSession) {
            currentToday += 1;
            currentMonth += 1;
            currentTotal += 1;

            // สั่งอัปเดตลงหน่วยความจำถาวรของเบราว์เซอร์
            localStorage.setItem(todayKey, currentToday);
            localStorage.setItem(monthKey, currentMonth);
            localStorage.setItem(totalKey, currentTotal);

            // ล็อกไว้ว่าเซสชันการเปิดรอบนี้บวกแต้มไปแล้วเรียบร้อยนะ
            sessionStorage.setItem('page_view_counted', 'true');
        }

        // 3. ส่งยอดที่นับได้จริงเข้าสู่ระบบสเตตัสเพื่อนำไปพ่นออกหน้าจอ Footer
        setVisitorStats({
            today: currentToday,
            month: currentMonth,
            total: currentTotal
        });
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            // ดึงจาก firebase โดยตรง (ตรวจสอบว่า import ไว้ข้างบนแล้ว)
            try {
                // 1. ดึงข้อมูลสมาชิก
                const memberSnapshot = await getDocs(collection(db, "members"));
                const membersData = memberSnapshot.docs.map(doc => {
                    const data = doc.data();

                    return { id: doc.id, ...data };
                });
                // น้าอัปเดต State ตรงๆ เลยครับ ไม่ต้องเช็ค length > 0
                setMembers(membersData);
                localStorage.setItem('local_members_data', JSON.stringify(membersData));

                // 2. ดึงข้อมูลหมู่บ้าน
                const villageSnapshot = await getDocs(collection(db, "villages"));
                const villagesData = villageSnapshot.docs.map(doc => doc.data());

                // ถ้ามีข้อมูลใน Firebase ค่อยอัปเดต ถ้าไม่มีให้ใช้ค่าเริ่มต้นที่น้ากำหนดไว้ใน State
                if (villagesData.length > 0) {
                    setVillages(villagesData);
                    localStorage.setItem('village_data', JSON.stringify(villagesData));
                }
            } catch (error) {
                console.error("ดึงข้อมูลผิดพลาด:", error);
                // ถ้าดึงไม่ได้ ให้ดึงจาก localStorage ออกมาแสดงแทน
                const savedMembers = localStorage.getItem('local_members_data');
                if (savedMembers) setMembers(JSON.parse(savedMembers));
            }
        };

        fetchData();
    }, []);

    const fetchAllMembersForStats = async () => {
        try {
            const q = query(collection(db, "members"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllMembers(data);
        } catch (err) {
            console.error("ดึงข้อมูลสมาชิกทั้งหมดพลาด:", err);
        }
    };

    useEffect(() => {
        fetchAllMembersForStats();
    }, []);

    useEffect(() => {
        const loadLogsFromCloud = async () => {
            try {
                // 1. ดึงข้อมูลจากคอลเลกชัน admin_logs
                const logsCollection = collection(db, "admin_logs");

                // 2. เรียงลำดับจากใหม่ไปเก่า (ตาม timestamp ที่เราเพิ่งเพิ่มเข้าไป)
                const q = query(logsCollection, orderBy("timestamp", "desc"), limit(50));
                const querySnapshot = await getDocs(q);

                // 3. แปลงข้อมูลให้อยู่ในรูปแบบที่ State ของน้าต้องการ
                const fetchedLogs = querySnapshot.docs.map(doc => ({
                    ...doc.data()
                }));

                // 4. เอา Log ที่ดึงมาได้ ไปใส่ใน State
                setAdminLogs(fetchedLogs);

                // 5. อัปเดต localStorage เผื่อกรณีออฟไลน์
                localStorage.setItem('admin_action_logs', JSON.stringify(fetchedLogs));

                console.log("โหลดประวัติจาก Cloud เรียบร้อย");
            } catch (err) {
                console.error("ดึงประวัติจาก Cloud ไม่สำเร็จ:", err);
            }
        };

        loadLogsFromCloud();
    }, []);

    // ☁️ [ปรับเป็นระบบคลาวด์]: ฟังก์ชันสำหรับคำนวณและบวกน้ำหนักขยะ/แต้มสะสมเพิ่มรายครัวเรือนพุ่งขึ้น Firebase
    const handleSaveWasteRecord = async (memberId, turnWasteData, turnCredit) => {
        let targetHouseNo = '';

        // 1. วิ่งไปค้นหาตัวสมาชิกรายนั้นใน State ปัจจุบัน
        const targetMemberObj = members.find(m => String(m.id) === String(memberId));
        if (!targetMemberObj) return alert("❌ ไม่พบข้อมูลสมาชิกรายนี้ในระบบ");

        targetHouseNo = targetMemberObj.houseNo;
        const nextWasteData = { ...targetMemberObj.wasteData };

        // วนลูปบวกสะสมค่าน้ำหนักขยะ
        Object.keys(turnWasteData).forEach(type => {
            nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(turnWasteData[type]) || 0);
        });

        const updatedMember = {
            ...targetMemberObj,
            wasteData: nextWasteData,
            credit: (Number(targetMemberObj.credit) || 0) + Number(turnCredit),
            isSorted: true
        };

        // 2. อัปเดตสมาชิกและเซฟลง LocalStorage
        const updatedMembers = members.map(m => String(m.id) === String(memberId) ? updatedMember : m);
        setMembers(updatedMembers);
        localStorage.setItem('local_members_data', JSON.stringify(updatedMembers));

        // 3. ☁️ ยิงอัปเดตขึ้น Cloud
        try {
            await setDoc(doc(db, "members", String(memberId)), updatedMember);
        } catch (err) {
            console.error("เซฟยอดขยะลงคลาวด์ล้มเหลว:", err);
        }

        // 4. นำปริมาณขยะรอบนี้ วิ่งไปบวกสะสมเพิ่มรวมเข้ากับ "หมวดใหญ่"
        setVillages(prevVillages => {
            const updatedVillages = prevVillages.map(v => {
                if (v.id === targetMemberObj.villageId) {
                    const nextVillageWaste = { ...v.wasteData };
                    Object.keys(turnWasteData).forEach(type => {
                        nextVillageWaste[type] = (Number(nextVillageWaste[type]) || 0) + (Number(turnWasteData[type]) || 0);
                    });
                    return {
                        ...v,
                        wasteData: nextVillageWaste,
                        credit: (Number(v.credit) || 0) + Number(turnCredit)
                    };
                }
                return v;
            });
            localStorage.setItem('village_data', JSON.stringify(updatedVillages));
            return updatedVillages;
        });

        // 5. บันทึกประวัติและแจ้งเตือน
        const typesSummary = Object.entries(turnWasteData)
            .filter(([_, w]) => w > 0)
            .map(([t, w]) => `${t} ${w} กก.`)
            .join(', ');

        logAdminAction(`บันทึกฝากขยะเพิ่มให้ "บ้านเลขที่ ${targetHouseNo}" สถิติ: [${typesSummary}] (+${turnCredit} แต้ม)`);

        setIsRecordWasteOpen(false);
        alert(`⚖️ บันทึกยอดขยะฝากเพิ่มสะสม และคำนวณแต้มสำเร็จ!`);
    };
    const [expandedMemberId, setExpandedMemberId] = React.useState(null); // ➕ บันทึกว่ากล่องของบ้านหลังไหนกำลังถูกคลิกเปิดดูรายชื่อ
    // สถานะหน้าจอและเมนู
    const [currentPage, setCurrentPage] = useState('dashboard'); // ควบคุมว่าตอนนี้อยู่หน้าไหน
    const [isLoggedIn, setIsLoggedIn] = useState(false);        // สถานะการเข้าสู่ระบบ
    const [isMenuOpen, setIsMenuOpen] = useState(false);        // สถานะการเปิด/ปิดเมนูมือถือ

    // ข้อมูลสมาชิกและตำแหน่ง
    const [members, setMembers] = useState([]);
    const [allMembers, setAllMembers] = useState([]);
    const [currentLocation, setCurrentLocation] = useState({ lat: 18.5244, lng: 99.0435 }); // จุดกึ่งกลางแผนที่ (อุโมงค์)
    const [currentUser, setCurrentUser] = useState(null);       // ข้อมูลแอดมินที่ล็อกอินอยู่

    // ข้อมูลสำหรับการแก้ไขและแจ้งเตือน
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [editingVillage, setEditingVillage] = useState(null);
    const [showValidationAlert, setShowValidationAlert] = useState(false);
    const [visitorStats, setVisitorStats] = useState({ today: 0, month: 0, total: 0 });
    const [isPriceEditing, setIsPriceEditing] = useState(false);

    // 📡 [ปรับเป็นระบบคลาวด์]: ตั้งค่าประวัติแอดมินเริ่มต้นเป็นกล่องเปล่าเพื่อรอดึงจากอินเทอร์เน็ต
    const [adminLogs, setAdminLogs] = useState([]);
    const [isRecordWasteOpen, setIsRecordWasteOpen] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // ➕ [เพิ่มใหม่]: ฟังก์ชันส่วนกลางสำหรับบันทึกประวัติการกระทำของเจ้าหน้าที่ระบบ
    const logAdminAction = async (actionText) => { // 1. เติม async เข้าไป
        const now = new Date();
        const ThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
        const dateString = `${now.getDate()} ${ThaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

        const newLog = {
            id: Date.now(),
            operator: currentUser ? currentUser.name : 'เจ้าหน้าที่ระบบ',
            action: actionText,
            time: timeString,
            date: dateString,
            timestamp: now // ➕ เพิ่ม timestamp จริงๆ เอาไว้ใช้เรียงลำดับใน Cloud
        };

        // 2. บันทึกลง Cloud (Firestore)
        try {
            await addDoc(collection(db, "admin_logs"), newLog);
            console.log("บันทึกประวัติการทำงานลง Cloud สำเร็จ");
        } catch (err) {
            console.error("บันทึกประวัติลง Cloud ไม่สำเร็จ:", err);
        }

        // 3. อัปเดตหน้าจอทันที (ไม่ต้องรอโหลดจาก Cloud)
        setAdminLogs(prev => {
            const nextLogs = [newLog, ...prev];
            localStorage.setItem('admin_action_logs', JSON.stringify(nextLogs));
            return nextLogs;
        });
    };

    // --- ฐานข้อมูล 9 หมวด (เชื่อมต่อ LocalStorage) ---
    const [villages, setVillages] = useState(() => {
        const saved = localStorage.getItem('village_data');
        if (saved) return JSON.parse(saved);

        // ถ้าไม่มีข้อมูลเก่า ให้สร้างข้อมูลเริ่มต้น 9 หมวด ของหมู่ 6
        return Array.from({ length: 9 }, (_, i) => ({
            id: i + 1,
            name: `หมวดที่ ${i + 1}`,
            goal: 1000,
            wasteData: {
                'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0
            },
            credit: 0
        }));

    });
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [tempLocation, setTempLocation] = useState(null); // ไว้เก็บพิกัดชั่วคราวก่อนกดเซฟ

    // --- 1. ข้อมูลเจ้าหน้าที่ (Database จำลอง) ---
    const [staffs] = useState([
        { id: 'admin01', username: 'mo', password: 'masterkey1', name: 'เจ้าหน้าที่ระบบ Mo' },
        { id: 'admin02', username: 'admin1', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 1' },
        { id: 'admin03', username: 'admin2', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 2' },
        { id: 'admin04', username: 'admin3', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 3' },
        { id: 'admin05', username: 'admin4', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 4' },
        { id: 'admin06', username: 'admin5', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 5' },
        { id: 'admin07', username: 'admin6', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 6' },
        { id: 'admin08', username: 'admin7', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 7' },
        { id: 'admin09', username: 'admin8', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 8' },
        { id: 'admin10', username: 'admin9', password: '12345', name: 'เจ้าหน้าที่หมวดที่ 9' },
    ]);
    const [currentStaff, setCurrentStaff] = useState(null);

    // --- 3. ประวัติการทิ้งขยะ (เชื่อมโยงกับกราฟแท่ง) ---
    const [transactions, setTransactions] = useState([]);

    // --- ฟังก์ชัน: ลบสมาชิกออกจากระบบ ---
    const handleDeleteMember = (memberId) => {
        const targetMem = members.find(m => m.id === memberId);
        if (window.confirm("คุณแน่ใจใช่ไหมที่จะลบสมาชิกคนนี้? ข้อมูลทั้งหมดจะหายไปทันที")) {
            if (targetMem) {
                logAdminAction(`ได้ลบข้อมูลครัวเรือน "บ้านเลขที่ ${targetMem.houseNo}" ออกจากฐานข้อมู`);
            }
            setMembers(prev => prev.filter(m => m.id !== memberId));
        }
    };

    // --- ฟังก์ชัน: ค้นหาตำแหน่งปัจจุบันผ่าน GPS ---
    const findMyLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentLocation({ lat: latitude, lng: longitude });
                    alert("พบตำแหน่งของคุณแล้ว!");
                },
                () => alert("โปรดเปิด GPS หรืออนุญาตให้เข้าถึงตำแหน่งใน Browser ครับ")
            );
        }
    };
    // --- ฟังก์ชัน: อัปเดตข้อมูลหมวดขยะและบันทึกลง LocalStorage ---
    const handleUpdateVillage = async (updatedVillage) => {
        try {
            // 1. อัปเดตขึ้น Firebase
            await setDoc(doc(db, "villages", String(updatedVillage.id)), updatedVillage);

            // 2. อัปเดต State และ LocalStorage
            setVillages(prevVillages => {
                const newVillages = prevVillages.map(v => v.id === updatedVillage.id ? updatedVillage : v);
                localStorage.setItem('village_data', JSON.stringify(newVillages));
                return newVillages;
            });

            setSelectedVillage(null);
            setTimeout(() => {
                setSelectedVillage(updatedVillage);
            }, 0);

            setEditingVillage(null);
        } catch (error) {
            console.error("อัปเดตข้อมูลหมู่บ้านล้มเหลว:", error);
            alert("❌ อัปเดตหมวดหมู่ลง Cloud ไม่สำเร็จ!");
        }
    };

    // --- 4. คำนวณค่าการลดการปล่อยคาร์บอน (Carbon Stats) ---
    // ใช้ค่าน้ำหนักขยะแต่ละประเภทมาคูณกับค่า Factor (เช่น อลูมิเนียมช่วยลดคาร์บอนได้เยอะที่สุดที่ 9.13)
    const carbonStats = useMemo(() => {
        const FACTORS = {
            'พลาสติก': 1.03,
            'กระดาษ': 0.85,
            'แก้ว': 0.25,
            'อลูมิเนียม': 9.13,
            'โลหะผสม': 1.21
        };
        let total = 0;
        villages.forEach(v => {
            Object.entries(v.wasteData || {}).forEach(([type, weight]) => {
                total += (Number(weight) * (FACTORS[type] || 0));
            });
        });
        return total;
    }, [villages]); // คำนวณใหม่เฉพาะเมื่อข้อมูลหมู่บ้าน (villages) เปลี่ยนแปลง

    // --- 5. สรุปสถิติ 5 กล่องหลักสำหรับหน้า Dashboard 
    const stats = useMemo(() => {
        // 1. รวมขยะรวมจากสมาชิกทุกคน
        const totalWeight = allMembers.reduce((acc, m) => {
            return acc + Object.values(m.wasteData || {}).reduce((a, b) => a + Number(b), 0);
        }, 0);

        // 2. หาประเภทขยะมากที่สุดจากสมาชิก
        const typeTotals = allMembers.reduce((acc, m) => {
            Object.entries(m.wasteData || {}).forEach(([type, weight]) => {
                acc[type] = (acc[type] || 0) + Number(weight);
            });
            return acc;
        }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });

        // หาตัวที่มากที่สุด
        const topType = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0];
        const topLabel = topType && topType[1] > 0 ? topType[0] : 'รอดำเนินการ';

        return [
            { label: 'ประเภทขยะมากที่สุด', value: topLabel, icon: <Database className="text-yellow-500" /> },
            { label: 'ขยะรวมทั้งระบบ', value: `${totalWeight.toLocaleString()} กก.`, icon: <TrendingUp className="text-yellow-500" /> },
            { label: 'เครดิตรวมทุกหมวด', value: allMembers.reduce((acc, m) => acc + (m.credit || 0), 0).toLocaleString(), icon: <Wallet className="text-yellow-500" /> },
            { label: 'จำนวนครัวเรือน', value: allMembers.length, icon: <Users className="text-yellow-500" /> },
            {
                label: 'ลดการปล่อยคาร์บอน',
                value: `${carbonStats.toFixed(2)} kgCO2e`,
                icon: <Leaf className="text-emerald-500" />,
                hasTooltip: true
            }
        ];
    }, [allMembers, carbonStats, villages]);

    // --- 6. ข้อมูลสรุปรายหมวด (Village Data Calculation) ---
    // ทำหน้าที่รวบรวมคะแนนจาก "รายบ้าน" และ "น้ำหนักขยะในหมวด" มารวมกันเป็นคะแนนรวมของแต่ละหมวด
    const villageData = useMemo(() => {
        return villages.map(v => {
            // 1. กรองสมาชิกที่อยู่หมวดนี้จริงๆ
            const vMembers = allMembers.filter(m => Number(m.villageId) === Number(v.id));

            // 2. คำนวณเครดิตรวมจากสมาชิกในหมวดนี้
            const memberCredits = vMembers.reduce((sum, m) => sum + (Number(m.credit) || 0), 0);
            const aggregatedWaste = vMembers.reduce((acc, m) => {
                const data = m.wasteData || {};
                Object.keys(data).forEach(type => {
                    acc[type] = (acc[type] || 0) + Number(data[type] || 0);
                });
                return acc;
            }, { 'พลาสติก': 0, 'กระดาษ': 0, 'แก้ว': 0, 'อลูมิเนียม': 0, 'โลหะผสม': 0 });
            // 3. ➕ คำนวณน้ำหนักขยะรวม (รวมทุกประเภทของทุกคนในหมวด)
            const totalWasteInVillage = vMembers.reduce((sum, m) => {
                const houseWaste = Object.values(m.wasteData || {}).reduce((a, b) => a + Number(b), 0);
                return sum + houseWaste;
            }, 0);

            return {
                ...v,
                members: vMembers.length,
                credit: Math.max(0, memberCredits),
                totalWaste: totalWasteInVillage,
                wasteData: aggregatedWaste,
                value: Math.max(0, memberCredits) > 0 ? Math.max(0, memberCredits) : 0.1
            };
        });
    }, [villages, allMembers]);

    // --- 7. ข้อมูลสำหรับกราฟแท่ง (Bar Chart Calculation) ---
    const wasteTypeData = useMemo(() => {
        const types = ['พลาสติก', 'กระดาษ', 'แก้ว', 'อลูมิเนียม', 'โลหะผสม'];

        // 1. รวมขยะทุกประเภทจากสมาชิกทุกคน
        const totals = allMembers.reduce((acc, m) => {
            Object.entries(m.wasteData || {}).forEach(([type, weight]) => {
                acc[type] = (acc[type] || 0) + Number(weight);
            });
            return acc;
        }, {});

        // 2. Map ออกมาเป็นอาร์เรย์เพื่อให้ Recharts นำไปวาดกราฟ
        return types.map(type => ({
            name: type,
            amount: totals[type] || 0
        }));
    }, [allMembers]);

    //* --- renderContent: ฟังก์ชันสำหรับตัดสินใจว่าจะแสดงหน้าจอไหน-- -
    //* ทำหน้าที่เหมือนสวิตช์ไฟ(Switch Case) ตามค่าของตัวแปร currentPage
    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <MemoizedDashboardView stats={stats} villageData={villageData} wasteTypeData={wasteTypeData} members={allMembers} setCurrentPage={setCurrentPage} />;

            case 'villages':
                return <VillagesView villageData={villageData} setSelectedVillage={setSelectedVillage} setCurrentPage={setCurrentPage} isLoggedIn={isLoggedIn} setEditingVillage={setEditingVillage} />;

            case 'prices':
                // 🔄 [แก้ไขสายส่ง Props]: ผูกส่งสเตตัสแก้ไขราคาขยะลัดข้ามหน้าจอไปควบคุมที่นี่
                return (
                    <PriceView
                        isLoggedIn={isLoggedIn}
                        isEditing={isPriceEditing}
                        setIsEditing={setIsPriceEditing}
                    />
                );

            case 'members':
                return <MembersView
                    members={members}
                    setMembers={setMembers}
                    villages={villages}
                    setVillages={setVillages}
                    isLoggedIn={isLoggedIn}
                    logAdminAction={logAdminAction} />;

            case 'history':
                // 🔄 [แก้ไขเปิดทำงานจริง]: ดีดส่งตัวแปร members เข้าหน้าประวัติเพื่อทำการแจกแจงรายบ้านจริง
                return <HistoryView members={members} />;

            case 'admin_logs':
                // ส่งต่อสเตตัสแอดมินล็อกเข้าไปทำงานในหน้าแยกได้อย่างปลอดภัย หน้าไม่ขาวแล้ว
                return <AdminLogsView adminLogs={adminLogs} setAdminLogs={setAdminLogs} />;
            case 'map':
                return !isMapLoaded ? (
                    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-3xl m-4 border-2 border-dashed border-slate-200">
                        <h3 className="font-bold text-slate-600 mb-4">แผนที่ครัวเรือนสมาชิก</h3>
                        <button
                            onClick={() => setIsMapLoaded(true)}
                            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg"
                        >
                            เปิดแผนที่ (กดเพื่อโหลด)
                        </button>
                    </div>
                ) : (
                    <React.Suspense fallback={<div className="h-[500px] flex items-center justify-center">กำลังเตรียมแผนที่...</div>}>
                        <MapView
                            currentLocation={currentLocation || { lat: 18.57, lng: 98.98 }}
                            members={members}
                            findMyLocation={findMyLocation}
                            onPinLocation={(loc) => {
                                setTempLocation(loc);
                                setIsAddMemberOpen(true);
                            }}
                            isLoggedIn={isLoggedIn}
                            villages={villages} // อย่าลืมส่งตัวแปร villages เข้าไปด้วยนะครับ
                        />
                    </React.Suspense>
                );

            case 'admin':
                return isLoggedIn ? (
                    <AdminPanel
                        currentUser={currentUser}
                        setCurrentPage={setCurrentPage}
                        members={allMembers}
                        setMembers={setMembers}
                        editingVillage={editingVillage}
                        setEditingVillage={setEditingVillage}
                        onDeleteMember={handleDeleteMember}
                        currentLocation={currentLocation}
                        setTempLocation={setTempLocation}
                        isAddMemberOpen={isAddMemberOpen}
                        setIsAddMemberOpen={setIsAddMemberOpen}
                        setIsPriceEditing={setIsPriceEditing}
                        villageData={villages}
                        isRecordWasteOpen={isRecordWasteOpen}
                        setIsRecordWasteOpen={setIsRecordWasteOpen}
                        onSaveWasteRecord={handleSaveWasteRecord}
                    />
                ) : (
                    <LoginView setIsLoggedIn={setIsLoggedIn} staffs={staffs} setCurrentUser={setCurrentUser} logAdminAction={logAdminAction} />
                );

            default:
                return <MemoizedDashboardView stats={stats} villageData={villageData} wasteTypeData={wasteTypeData} members={allMembers} setCurrentPage={setCurrentPage} />;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-800">

            {/* ── 🟢 1. แถบเมนูข้าง Sidebar (แสดงเฉพาะจอ Desktop เท่านั้น) ── */}
            <aside className="hidden md:flex w-72 flex-col bg-gradient-to-b from-[#69c962] to-[#55b66c] p-6 shadow-xl shrink-0 select-none sticky top-0 h-screen overflow-y-auto">

                {/* โลโก้และชื่อเว็บ (จัดเรียงใหม่ ปรับขนาดใหญ่ขึ้น และวางกึ่งกลาง) */}
                <div className="flex flex-col items-center text-center gap-3 mb-6 cursor-pointer border-b border-white/30 pb-6 mt-2" onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); }}>
                    <div className="bg-white p-2.5 rounded-2xl shadow-md">
                        <img src={webLogo} alt="โลโก้" className="w-16 h-16 object-contain" />
                    </div>
                    <div className="flex flex-col text-white mt-1">
                        <span className="font-black text-xl tracking-tight leading-tight drop-shadow-sm">ธนาคารขยะบ้านป่าลาน</span>
                        <span className="text-sm text-green-100 font-bold opacity-90 drop-shadow-sm mt-1">เทศบาลตำบลอุโมงค์</span>
                    </div>
                </div>

                {/* เมนูหลัก (ปรับฟอนต์ใหญ่ขึ้น + มีเส้นแบ่งขีดใต้บรรทัดชัดเจน) */}
                <nav className="flex flex-col flex-grow w-full">
                    <button
                        onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'dashboard' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        📊 ภาพรวมระบบ
                    </button>
                    <button
                        onClick={() => { setCurrentPage('villages'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'villages' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🏠 ข้อมูลสมาชิก
                    </button>
                    <button
                        onClick={() => { setCurrentPage('prices'); setIsMapLoaded(false); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'prices' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🪙 ราคารับซื้อ
                    </button>
                    <button
                        onClick={() => { setCurrentPage('map'); }}
                        className={`w-full text-left px-4 py-4 text-base font-bold transition-all border-b border-white/30 ${currentPage === 'map' ? 'bg-white text-emerald-700 shadow-md rounded-xl border-transparent' : 'text-white hover:bg-white/10 hover:rounded-xl'}`}>
                        🗺️ แผนที่ครัวเรือน
                    </button>

                    {/* ปุ่มจัดการแอดมิน */}
                    {isLoggedIn && (
                        <button
                            onClick={() => { setCurrentPage('admin'); setIsMapLoaded(false); }}
                            className={`w-full text-left px-4 py-4 text-base font-bold transition-all mt-6 rounded-xl border ${currentPage === 'admin' ? 'bg-amber-400 text-slate-900 shadow-md border-transparent' : 'border-white/40 text-white hover:bg-white/10 bg-black/10'}`}>
                            🛠️ จัดการระบบแอดมิน
                        </button>
                    )}
                </nav>

                {/* ข้อมูลแอดมิน */}
                {isLoggedIn && currentUser && (
                    <div className="pt-5 border-t border-white/30 text-white text-sm mt-4 text-center">
                        <p className="opacity-70">ผู้ใช้งานปัจจุบัน:</p>
                        <p className="font-black mt-1 text-amber-300 drop-shadow-sm">👤 {currentUser.name}</p>
                    </div>
                )}
            </aside>

            {/* ── ⚪ 2. พื้นที่เนื้อหาหลักฝั่งขวา (Main Content) ── */}
            <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">

                {/* Header Desktop */}
                <header className="hidden md:flex bg-white border-b border-slate-100 px-8 py-5 items-center justify-between sticky top-0 z-40 shadow-sm">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                        {currentPage === 'dashboard' && '📊 ภาพรวมระบบและสถิติ'}
                        {currentPage === 'villages' && '🏠 ทะเบียนข้อมูลสมาชิกแต่ละหมวด'}
                        {currentPage === 'prices' && '🪙 ตารางราคารับซื้อขยะประจำเดือน'}
                        {currentPage === 'map' && '🗺️ ระบบแผนที่ครัวเรือนระบบสารสนเทศ'}
                        {currentPage === 'admin' && '🛠️ แผงควบคุมระบบจัดการแอดมิน'}
                        {currentPage === 'members' && '👥 ทะเบียนรายชื่อสมาชิกระบบ'}
                        {currentPage === 'history' && '📋 ทะเบียนสรุปแต้มเครดิตรายครัวเรือน'}
                        {currentPage === 'admin_logs' && '📜 ประวัติกิจกรรมการทำงานของเจ้าหน้าที่'}
                    </h2>
                    <div>
                        {!isLoggedIn ? (
                            <button onClick={() => setCurrentPage('admin')} className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"><LogIn size={14} /> <span>เข้าสู่ระบบ</span></button>
                        ) : (
                            <button onClick={() => { setIsLoggedIn(false); setCurrentPage('dashboard'); }} className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-red-100 flex items-center gap-1.5 shadow-sm"><LogIn size={14} className="rotate-180" /> <span>ออกจากระบบ</span></button>
                        )}
                    </div>
                </header>

                {/* Header Mobile */}
                <header className="md:hidden bg-emerald-900 sticky top-0 z-50 shadow-sm">
                    <div className="px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentPage('dashboard'); setIsMenuOpen(false); }}>
                            <img src={webLogo} alt="โลโก้" className="w-8 h-8 object-contain bg-white rounded-lg p-0.5" />
                            <span className="font-black text-sm text-white tracking-tight">ธนาคารขยะบ้านป่าลาน</span>
                        </div>
                        <button onClick={() => { if (isLoggedIn) { setIsLoggedIn(false); setCurrentPage('dashboard'); } else { setCurrentPage('admin'); } }} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-white/20 transition-colors">
                            {isLoggedIn ? 'ออกจากระบบ' : 'เข้าสู่ระบบ'}
                        </button>
                    </div>
                    <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-emerald-950 text-white px-4 py-3.5 flex items-center justify-between border-t border-emerald-800 cursor-pointer active:bg-emerald-900 transition-colors select-none">
                        <div className="flex items-center gap-2 font-black text-xs tracking-wide">
                            <Menu size={16} className="text-emerald-400" />
                            <span>เมนูตัวเลือกระบบ</span>
                        </div>
                        <div className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={16} className="text-emerald-400" />
                        </div>
                    </div>
                </header>

                {/* Mobile Menu Dropdown */}
                {isMenuOpen && (
                    <div className="md:hidden bg-white border-b border-slate-200 p-4 flex flex-col gap-1.5 shadow-xl animate-fadeIn sticky top-[105px] z-40">
                        <MobileNavItem active={currentPage === 'dashboard'} onClick={() => { setCurrentPage('dashboard'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="📊 ภาพรวมระบบ" icon={<LayoutDashboard size={20} />} />
                        <MobileNavItem active={currentPage === 'villages'} onClick={() => { setCurrentPage('villages'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="🏠 ข้อมูลสมาชิก" icon={<Users size={20} />} />
                        <MobileNavItem active={currentPage === 'prices'} onClick={() => { setCurrentPage('prices'); setIsMapLoaded(false); setIsMenuOpen(false); }} label="🪙 ราคารับซื้อ" icon={<Wallet size={20} />} />
                        <MobileNavItem active={currentPage === 'map'} onClick={() => { setCurrentPage('map'); setIsMenuOpen(false); }} label="🗺️ แผนที่ครัวเรือน" icon={<MapIcon size={20} />} />
                        {isLoggedIn && (
                            <button onClick={() => { setCurrentPage('admin'); setIsMapLoaded(false); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl text-sm font-black mt-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                                <LayoutDashboard size={20} /> <span>🛠️ จัดการระบบแอดมิน</span>
                            </button>
                        )}
                    </div>
                )}

                {/* ── 📦 3. ส่วนเนื้อหา (แสดงกราฟ ตาราง สถิติ) ── */}
                <div className="flex-grow p-4 md:p-8 max-w-[1600px] w-full mx-auto">
                    {renderContent()}
                </div>

                {/* ── Footer ── */}
                <footer className="bg-white border-t border-slate-100 py-6 mt-auto">
                    <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                        <div className="flex flex-wrap justify-center gap-3 mb-3">
                            <span className="font-bold text-slate-400 flex items-center">📊 สถิติผู้เข้าชม:</span>
                            <span className="font-mono bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold shadow-sm">วันนี้: {(visitorStats?.today || 0).toLocaleString()}</span>
                            <span className="font-mono bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold shadow-sm">เดือนนี้: {(visitorStats?.month || 0).toLocaleString()}</span>
                            <span className="font-mono bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg font-black text-emerald-600 shadow-sm">รวมทั้งหมด: {(visitorStats?.total || 0).toLocaleString()} รอบ</span>
                        </div>
                        <p className="font-medium">© 2026 กองสาธารณสุขและสิ่งแวดล้อมเทศบาลตำบลอุโมงค์</p>
                    </div>
                </footer>

            </main>

            {/* ── 🚨 4. แจ้งเตือนและป๊อปอัพ (Modals) ── */}
            {showValidationAlert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border text-slate-700 animate-in zoom-in">
                        <div className="flex items-center gap-3 text-amber-600 mb-4">
                            <AlertTriangle size={32} />
                            <h3 className="font-bold text-xl">แจ้งเตือนข้อมูลผิดปกติ</h3>
                        </div>
                        <p className="text-slate-600 mb-6 text-sm font-medium">น้ำหนักที่ระบุ (5000 กก.) สูงกว่าค่าเฉลี่ยปกติ กรุณาตรวจสอบเลขศูนย์หรือหน่วยวัดอีกครั้ง</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowValidationAlert(false)} className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm transition-colors">แก้ไข</button>
                            <button onClick={() => setShowValidationAlert(false)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">ยืนยันค่านี้</button>
                        </div>
                    </div>
                </div>
            )}

            {editingVillage && (
                <EditVillageModal village={editingVillage} members={allMembers} onClose={() => setEditingVillage(null)} onSave={handleUpdateVillage} onDeleteMember={handleDeleteMember} />
            )}

            {isAddMemberOpen && tempLocation && (
                <AddMemberModal
                    initialLat={tempLocation.lat} initialLng={tempLocation.lng} villageData={villages}
                    onSave={async (newMemberData) => {
                        const dataToSave = { ...newMemberData, villageId: Number(newMemberData.villageId) };
                        try { await setDoc(doc(db, "members", String(newMemberData.id)), newMemberData); }
                        catch (error) { alert("บันทึกเข้าฐานข้อมูลไม่สำเร็จ!"); return; }
                        logAdminAction(`ได้ลงทะเบียนและปักหมุดสมาชิกใหม่ "บ้านเลขที่ ${newMemberData.houseNo}" เข้าสู่หมวดระบบ`);
                        setMembers(prev => {
                            const nextMembers = [...prev, newMemberData];
                            localStorage.setItem('local_members_data', JSON.stringify(nextMembers));
                            return nextMembers;
                        });
                        setVillages(prevVillages => {
                            const updatedVillages = prevVillages.map(v => {
                                if (v.id === newMemberData.villageId) {
                                    const nextWasteData = { ...v.wasteData };
                                    Object.keys(newMemberData.wasteData).forEach(type => {
                                        nextWasteData[type] = (Number(nextWasteData[type]) || 0) + (Number(newMemberData.wasteData[type]) || 0);
                                    });
                                    return { ...v, wasteData: nextWasteData };
                                }
                                return v;
                            });
                            localStorage.setItem('village_data', JSON.stringify(updatedVillages));
                            return updatedVillages;
                        });
                        setIsAddMemberOpen(false); setTempLocation(null); alert("📍 ลงทะเบียนสมาชิกครัวเรือนใหม่สำเร็จ!");
                    }}
                    onClose={() => { setIsAddMemberOpen(false); setTempLocation(null); }}
                />
            )}

            {selectedVillage && (
                <VillageDetailsModal
                    key={selectedVillage.id + JSON.stringify(selectedVillage.wasteData)}
                    village={selectedVillage} onClose={() => setSelectedVillage(null)} villages={villages} members={members}
                />
            )}
        </div>
    );
};
export default App;