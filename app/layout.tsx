import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DYB",
  description: "DYB 的个人博客，记录软件工程学习、项目实践与随笔。",
  icons: { icon: "/assets/mark.svg" }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
