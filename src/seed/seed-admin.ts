import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { User, UserRole } from '../entities/user.entity';

dotenv.config({ path: '.env' });

async function seedAdmin() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected');

    const userRepository = dataSource.getRepository(User);

    const existingAdmin = await userRepository.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      console.log(`Admin user already exists: ${existingAdmin.email}`);
      console.log('Skipping seed.');
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'Admin';

    const existingUser = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingUser) {
      await userRepository.update(existingUser.id, {
        role: UserRole.ADMIN,
        isActive: true,
        isVerified: true,
      });
      console.log(`Existing user "${adminEmail}" promoted to admin.`);
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = userRepository.create({
      email: adminEmail,
      passwordHash,
      fullName: adminName,
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
    });

    await userRepository.save(admin);
    console.log(`Admin user created successfully!`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role: admin`);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin();
