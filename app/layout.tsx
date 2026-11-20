import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DYB 观测站",
  description: "DYB 的星图、博客、项目与生活记录。",
  icons: { icon: "/assets/mark.svg" }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
