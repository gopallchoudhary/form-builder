"use client";
import { trpc } from "~/trpc/client";
import { api } from "~/trpc/server";

export default function Home() {
  const { data } = trpc.chaicode.useQuery({ email: "go12@gmail.com", name: "Gopal", age: 25 });
  return (
    <main className="min-h-screen min-w-screen flex justify-center items-center">
      <div>
        <h1 className="text-5xl">Server Message: {data?.message}</h1>
      </div>
    </main>
  );
}
