declare global {
	namespace App {
		interface Locals {
			session: {
				id: string;
				nickname: string;
				color: string;
			} | null;
		}
	}
}

export {};
