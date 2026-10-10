import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{
 id:text('id').primaryKey(),authId:text('auth_id'),email:text('email').notNull(),name:text('name').notNull(),phone:text('phone').notNull().default(''),role:text('role').notNull().default('customer'),active:integer('active').notNull().default(1),isOwner:integer('is_owner').notNull().default(0),createdAt:text('created_at').notNull(),version:integer('version').notNull().default(1)
},t=>[uniqueIndex('users_auth_unique').on(t.authId),uniqueIndex('users_email_unique').on(t.email)]);
export const enquiries=sqliteTable('enquiries',{
 id:text('id').primaryKey(),reference:text('reference').notNull(),customerId:text('customer_id').references(()=>users.id),assignedTo:text('assigned_to').references(()=>users.id),name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull().default(''),interest:text('interest').notNull(),destination:text('destination').notNull().default(''),checkin:text('checkin'),checkout:text('checkout'),guests:integer('guests').notNull().default(2),style:text('style').notNull().default(''),notes:text('notes').notNull().default(''),status:text('status').notNull().default('new'),followupDate:text('followup_date'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),version:integer('version').notNull().default(1)
},t=>[uniqueIndex('enquiries_reference_unique').on(t.reference),index('enquiries_customer').on(t.customerId),index('enquiries_assignment').on(t.assignedTo),index('enquiries_email_created').on(t.email,t.createdAt)]);
export const notes=sqliteTable('notes',{
 id:text('id').primaryKey(),enquiryId:text('enquiry_id').notNull().references(()=>enquiries.id),authorId:text('author_id').notNull().references(()=>users.id),body:text('body').notNull(),createdAt:text('created_at').notNull()
},t=>[index('notes_enquiry').on(t.enquiryId)]);
export const memberships=sqliteTable('memberships',{
 id:text('id').primaryKey(),customerId:text('customer_id').notNull().references(()=>users.id),planName:text('plan_name').notNull(),status:text('status').notNull().default('pending'),startDate:text('start_date').notNull(),endDate:text('end_date').notNull(),entitledNights:integer('entitled_nights').notNull().default(0),usedNights:integer('used_nights').notNull().default(0),amountMinor:integer('amount_minor').notNull().default(0),paidMinor:integer('paid_minor').notNull().default(0),notes:text('notes').notNull().default(''),createdAt:text('created_at').notNull(),version:integer('version').notNull().default(1)
},t=>[index('memberships_customer').on(t.customerId)]);
export const bookings=sqliteTable('bookings',{
 id:text('id').primaryKey(),reference:text('reference').notNull(),enquiryId:text('enquiry_id').notNull().references(()=>enquiries.id),membershipId:text('membership_id').references(()=>memberships.id),destination:text('destination').notNull(),propertyName:text('property_name').notNull().default(''),checkin:text('checkin').notNull(),checkout:text('checkout').notNull(),guests:integer('guests').notNull().default(2),status:text('status').notNull().default('requested'),amountMinor:integer('amount_minor').notNull().default(0),paidMinor:integer('paid_minor').notNull().default(0),notes:text('notes').notNull().default(''),createdAt:text('created_at').notNull(),version:integer('version').notNull().default(1)
},t=>[uniqueIndex('bookings_reference_unique').on(t.reference),index('bookings_enquiry').on(t.enquiryId)]);
export const tasks=sqliteTable('tasks',{
 id:text('id').primaryKey(),title:text('title').notNull(),details:text('details').notNull().default(''),assignedTo:text('assigned_to').notNull().references(()=>users.id),enquiryId:text('enquiry_id').references(()=>enquiries.id),dueDate:text('due_date').notNull(),status:text('status').notNull().default('todo'),priority:text('priority').notNull().default('normal'),createdBy:text('created_by').notNull().references(()=>users.id),createdAt:text('created_at').notNull(),version:integer('version').notNull().default(1)
},t=>[index('tasks_assignment').on(t.assignedTo)]);
export const audit=sqliteTable('audit_events',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull().references(()=>users.id),action:text('action').notNull(),entityType:text('entity_type').notNull(),entityId:text('entity_id').notNull(),createdAt:text('created_at').notNull()
});
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const destinations=sqliteTable('destinations',{
 id:text('id').primaryKey(),slug:text('slug').notNull(),title:text('title').notNull(),region:text('region').notNull(),location:text('location').notNull(),category:text('category').notNull(),summary:text('summary').notNull(),description:text('description').notNull(),image:text('image').notNull(),nights:integer('nights').notNull().default(4),highlights:text('highlights').notNull().default('[]'),active:integer('active').notNull().default(1),version:integer('version').notNull().default(1)
},t=>[uniqueIndex('destinations_slug_unique').on(t.slug)]);
