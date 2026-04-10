"use client";

import { useState } from "react";

type MerchantRow = {
  id: string;
  businessName: string;
  status: "NEW" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: { email: string };
};

const STATUS_LABELS: Record<MerchantRow["status"], string> = {
  NEW: "Новый",
  IN_REVIEW: "На проверке",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
};

const STATUS_STYLES: Record<MerchantRow["status"], string> = {
  NEW: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function MerchantsTable({ merchants }: { merchants: MerchantRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = merchants.filter(
    (m) =>
      m.businessName.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-5 border-b border-gray-100">
        <input
          type="text"
          placeholder="Поиск по компании или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-base font-medium">Пока нет заявок</p>
          <p className="text-sm mt-1">Создайте ссылку для клиента, чтобы начать онбординг</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Компания</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Статус</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Дата подачи</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((merchant) => (
                <tr key={merchant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{merchant.businessName}</td>
                  <td className="px-6 py-4 text-gray-600">{merchant.user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[merchant.status]}`}>
                      {STATUS_LABELS[merchant.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(merchant.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`/merchants/${merchant.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      Открыть
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
