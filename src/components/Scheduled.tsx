import styles from '../css/Scheduled.module.css'


const Scheduled = () => {
    return(
        <div className={styles.Scheduled}>
            <div className={styles.Schedule_head}>
                <select name="" id="">
                    <option value="">This Week</option>
                    <option value="">This Week</option>
                </select>

                <span>Last edited: 04/23/2025 01:24 AM</span>
            </div>
            <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time In</th>
        <th>Time Out</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Monday</td>
        <td>9:00 AM</td>
        <td>5:00 PM</td>
      </tr>
      <tr>
        <td>Tuesday</td>
        <td>9:00 AM</td>
        <td>5:00 PM</td>
      </tr>
      <tr>
        <td>Wednesday</td>
        <td>9:00 AM</td>
        <td>5:00 PM</td>
      </tr>
      <tr>
        <td>Thursday</td>
        <td>9:00 AM</td>
        <td>5:00 PM</td>
      </tr>
      <tr>
        <td>Friday</td>
        <td>9:00 AM</td>
        <td>5:00 PM</td>
      </tr>
    </tbody>
  </table>
        </div>
    )
}

export default Scheduled;