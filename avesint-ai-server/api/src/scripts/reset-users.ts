// src/scripts/reset-users.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { Role } from '../users/role.enum';
import { User } from '../users/user.entity';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    const usersService = app.get(UsersService);

    // 1. Почистити залежні таблиці та users через TRUNCATE ... CASCADE
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // важливо: CASCADE, щоб прибрати залежні рядки (events, audit-log тощо)
      await queryRunner.query('TRUNCATE TABLE "events" CASCADE');
      await queryRunner.query('TRUNCATE TABLE "users" CASCADE');
    } finally {
      await queryRunner.release();
    }

    const password = '123456';

    // 2. Створити нових користувачів
    await usersService.create(
      { callsign: 'ADMIN', password, displayName: 'ADMIN' } as any,
      Role.ADMIN,
    );
    await usersService.create(
      { callsign: 'OFFICER', password, displayName: 'OFFICER' } as any,
      Role.OFFICER,
    );
    await usersService.create(
      { callsign: 'ANALYST', password, displayName: 'ANALYST' } as any,
      Role.ANALYST,
    );
    await usersService.create(
      { callsign: 'USER', password, displayName: 'USER' } as any,
      Role.USER,
    );

    console.log('Users reset and seeded successfully');
  } catch (e) {
    console.error('Error while seeding users', e);
  } finally {
    await app.close();
  }
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed', e);
  process.exit(1);
});
